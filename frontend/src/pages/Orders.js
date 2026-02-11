import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  CardActions,
  List,
  ListItem,
  ListItemText,
  Divider,
  Box,
  Chip,
  InputAdornment,
  IconButton,
  useMediaQuery,
  FormControlLabel,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Fab,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddTaskIcon from "@mui/icons-material/AddTask";
import AssignmentIcon from "@mui/icons-material/Assignment";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import ScheduleIcon from "@mui/icons-material/Schedule";
import EditIcon from "@mui/icons-material/Edit";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import StickyNote2Icon from "@mui/icons-material/StickyNote2";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PaidIcon from "@mui/icons-material/Paid";
import { getApiBaseUrl } from "../api";
import {
  formatCategoryLabel,
  getCategoriesForVehicleType,
  getSubcategoriesForCategoryKey,
  getWorktimeCategoryKey,
  getWorktimeSubcategoryKey,
} from "../utils/worktimeClassification";

export default function Orders({ t, userRole = 'user', userPermissions = [] }) {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    client_id: null,
    client_name: "",
    reg_number: "",
    complaint: "",
  });
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [orderWorktimes, setOrderWorktimes] = useState([]);
  const [availableWorktimes, setAvailableWorktimes] = useState([]);
  const [worktimeSelectionOpen, setWorktimeSelectionOpen] = useState(false);

  // --- Packages (fixed-price operations) ---
  const [orderPackages, setOrderPackages] = useState([]);
  const [availablePackages, setAvailablePackages] = useState([]);
  const [packageSelectionOpen, setPackageSelectionOpen] = useState(false);
  const [packageSearch, setPackageSearch] = useState('');
  const [packageForm, setPackageForm] = useState({
    quantity: 1,
    notes: '',
    price: '',
    is_price_correction: 0,
  });
  const [selectedPackageToAdd, setSelectedPackageToAdd] = useState(null);
  const [packagePriceDialogOpen, setPackagePriceDialogOpen] = useState(false);

  // Order package details/edit
  const [packageDetailsOpen, setPackageDetailsOpen] = useState(false);
  const [selectedOrderPackage, setSelectedOrderPackage] = useState(null);
  const [packageEditDraft, setPackageEditDraft] = useState({ quantity: 1, notes: '', price: '', is_price_correction: 0 });

  // Work card add-mode
  const [addMode, setAddMode] = useState('worktimes'); // 'worktimes' | 'packages'
  const [orderVehicleType, setOrderVehicleType] = useState('truck');
  const [worktimeCategoryKey, setWorktimeCategoryKey] = useState('regular');
  const [worktimeSubcategoryKey, setWorktimeSubcategoryKey] = useState('');
  // Step navigation inside the "pick worktime" modal:
  // Group -> Subgroup -> Worktime
  const [worktimeNavStep, setWorktimeNavStep] = useState('category'); // 'category' | 'subcategory' | 'worktimes'
  const [worktimeSearch, setWorktimeSearch] = useState("");
  const [worktimeForm, setWorktimeForm] = useState({
    worktime_id: "",
    quantity: 1,
    notes: ""
  });
  const [showCreateWorktime, setShowCreateWorktime] = useState(false);
  const [newWorktimeForm, setNewWorktimeForm] = useState({
    title: "",
    hours: "",
    // Main category key (e.g. "engine")
    component_type: "regular",
    // Truck-only numeric subgroup key (e.g. "21")
    subcomponent_type: "",
  });
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [editingWorktime, setEditingWorktime] = useState(null);
  const [notesText, setNotesText] = useState("");
  const [worktimeDetailsOpen, setWorktimeDetailsOpen] = useState(false);
  const [selectedOrderWorktime, setSelectedOrderWorktime] = useState(null);
  const [worktimeInfoOpen, setWorktimeInfoOpen] = useState(false);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Make dialogs fullscreen on desktop (requested) and also on mobile.
  const isDesktop = useMediaQuery('(min-width:900px)');
  const isMobile = useMediaQuery('(max-width:600px)');
  const fullScreenDialog = isDesktop || isMobile;

  const canAccessModule = (moduleKey) => {
    if (userRole === 'admin') return true;
    const perms = Array.isArray(userPermissions) ? userPermissions : [];
    const p = perms.find((x) => x.module === moduleKey);
    return Number(p?.can_access_module) === 1 && Number(p?.can_read) === 1;
  };

  const canWriteModule = (moduleKey) => {
    if (userRole === 'admin') return true;
    const perms = Array.isArray(userPermissions) ? userPermissions : [];
    const p = perms.find((x) => x.module === moduleKey);
    return Number(p?.can_access_module) === 1 && Number(p?.can_write) === 1;
  };

  const canUseWorktimes = canAccessModule('worktimes');
  const canUsePackages = canAccessModule('packages');
  const canWritePackages = canWriteModule('packages');

  // Ensure the currently selected add-mode is always permitted.
  useEffect(() => {
    if (addMode === 'worktimes' && !canUseWorktimes && canUsePackages) {
      setAddMode('packages');
      return;
    }
    if (addMode === 'packages' && !canUsePackages && canUseWorktimes) {
      setAddMode('worktimes');
    }
  }, [addMode, canUseWorktimes, canUsePackages]);

  // Higher-contrast, no-gradients UI tokens (used in the Work Order / Order Details dialog)
  const hcDialogTitleSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    backgroundColor: (theme) => theme.palette.background.paper,
    color: 'text.primary',
    borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
    fontWeight: 900,
    fontSize: '1.1rem',
    mb: 0,
    py: 1.25,
  };
  const hcSectionPaperSx = {
    p: { xs: 1.25, sm: 2 },
    borderRadius: 2,
    border: (theme) => `2px solid ${theme.palette.divider}`,
    backgroundColor: (theme) => theme.palette.background.paper,
  };
  const hcKpiBoxSx = {
    p: 1,
    borderRadius: 2,
    border: (theme) => `2px solid ${theme.palette.divider}`,
    textAlign: 'center',
    backgroundColor: (theme) => theme.palette.background.default,
  };

  // Keep everything perfectly aligned to the same left/right edges.
  // (No fixed maxWidth – use the available content width.)
  const pageColumnSx = { width: '100%' };

  const selectionCategories = getCategoriesForVehicleType(orderVehicleType);

  const selectionSubcategories = useMemo(() => {
    if (orderVehicleType === 'trailer') return [];
    return getSubcategoriesForCategoryKey(orderVehicleType, worktimeCategoryKey);
  }, [orderVehicleType, worktimeCategoryKey]);

  const hasLegacyWorktimesInSelectedCategory = useMemo(() => {
    if (orderVehicleType === 'trailer') return false;
    return (availableWorktimes || []).some((w) => {
      if (getWorktimeCategoryKey(w, orderVehicleType) !== worktimeCategoryKey) return false;
      return !getWorktimeSubcategoryKey(w, orderVehicleType);
    });
  }, [availableWorktimes, orderVehicleType, worktimeCategoryKey]);

  const selectionSubcategoriesWithLegacy = useMemo(() => {
    if (orderVehicleType === 'trailer') return [];
    const base = Array.isArray(selectionSubcategories) ? selectionSubcategories : [];
    if (!hasLegacyWorktimesInSelectedCategory) return base;
    return [...base, { key: '__legacy__', no: '—', label: 'Неразпределени (стар тип)' }];
  }, [orderVehicleType, selectionSubcategories, hasLegacyWorktimesInSelectedCategory]);

  const countBySelectionSubcategoryKey = useMemo(() => {
    const map = {};
    if (orderVehicleType === 'trailer') return map;

    (availableWorktimes || []).forEach((w) => {
      if (getWorktimeCategoryKey(w, orderVehicleType) !== worktimeCategoryKey) return;
      const subKey = getWorktimeSubcategoryKey(w, orderVehicleType);
      const key = subKey ? subKey : '__legacy__';
      map[key] = (map[key] || 0) + 1;
    });

    return map;
  }, [availableWorktimes, orderVehicleType, worktimeCategoryKey]);

  const filteredAvailableWorktimes = useMemo(() => {
    const q = String(worktimeSearch || '').trim().toLowerCase();
    const list = Array.isArray(availableWorktimes) ? availableWorktimes : [];
    return list
      .filter((w) => getWorktimeCategoryKey(w, orderVehicleType) === worktimeCategoryKey)
      .filter((w) => {
        if (orderVehicleType === 'trailer') return true;
        if (!selectionSubcategoriesWithLegacy.length) return true;

        // Enforce: Main Group -> Subgroup -> Worktime
        if (!worktimeSubcategoryKey) return false;
        const subKey = getWorktimeSubcategoryKey(w, orderVehicleType);
        if (worktimeSubcategoryKey === '__legacy__') return !subKey;
        return subKey === worktimeSubcategoryKey;
      })
      .filter((w) => {
        if (!q) return true;
        const catLabel = formatCategoryLabel(orderVehicleType, w.component_type);
        return `${w.title} ${w.component_type} ${catLabel}`.toLowerCase().includes(q);
      });
  }, [availableWorktimes, orderVehicleType, worktimeCategoryKey, worktimeSubcategoryKey, worktimeSearch, selectionSubcategoriesWithLegacy.length]);

  useEffect(() => {
    loadOrders();

    // Check for order draft from localStorage
    const orderDraft = localStorage.getItem('orderDraft');
    if (orderDraft) {
      const draft = JSON.parse(orderDraft);
      setForm(draft);
      localStorage.removeItem('orderDraft'); // Clear the draft
    }
  }, []);

  async function loadOrders() {
    const res = await axios.get(`${getApiBaseUrl()}/orders`);
    setOrders(res.data);
  }

  async function searchOrders() {
    if (search.trim()) {
      const res = await axios.get(`${getApiBaseUrl()}/orders/search?q=${search}`);
      setOrders(res.data);
    } else {
      loadOrders();
    }
  }

  async function createOrder() {
    // Валидация - проверка дали всички полета са попълнени
    if (!form.client_name.trim() || !form.reg_number.trim() || !form.complaint.trim()) {
      alert('Моля попълнете всички полета: Име на клиент, Регистрационен номер и Оплакване');
      return false;
    }

    try {
      await axios.post(`${getApiBaseUrl()}/orders`, form);
      setForm({ client_id: null, client_name: "", reg_number: "", complaint: "" });
      loadOrders();
      return true;
    } catch (error) {
      alert('Грешка при създаване на поръчка: ' + (error.response?.data?.error || error.message));
      return false;
    }
  }

  async function deleteOrder(id) {
    try {
      await axios.delete(`${getApiBaseUrl()}/orders/${id}`);
      loadOrders();
    } catch (error) {
      alert('Грешка при изтриване на поръчката');
    }
  }

  const requestDeleteOrder = (order) => {
    setOrderToDelete(order);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete?.id) return;
    try {
      setDeleteLoading(true);
      await deleteOrder(orderToDelete.id);
      setDeleteConfirmOpen(false);
      setOrderToDelete(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Worktimes statistics for the currently opened order
  const totalWorktimesCount = orderWorktimes.length;
  const totalWorktimesQuantity = orderWorktimes.reduce((sum, ow) => sum + (Number(ow?.quantity) || 0), 0);
  const totalWorktimesHours = orderWorktimes.reduce(
    (sum, ow) => sum + (Number(ow?.hours) || 0) * (Number(ow?.quantity) || 0),
    0
  );

  // Packages statistics
  const totalPackagesCount = orderPackages.length;
  // Note: kept for future UI KPIs.
  // const totalPackagesQuantity = orderPackages.reduce((sum, op) => sum + (Number(op?.quantity) || 0), 0);
  const totalPackagesHours = orderPackages.reduce(
    (sum, op) => sum + (Number(op?.hours) || 0) * (Number(op?.quantity) || 0),
    0
  );

  const totalAllHours = totalWorktimesHours + totalPackagesHours;

  // UI helper: if there are legacy duplicates (same operation + same hours) with NO notes,
  // collapse them into one row by increasing the quantity.
  const displayedOrderWorktimes = useMemo(() => {
    const rows = Array.isArray(orderWorktimes) ? orderWorktimes : [];
    const out = [];
    const indexByKey = new Map();

    rows.forEach((ow) => {
      const notes = String(ow?.notes || '').trim();
      const qty = Number(ow?.quantity) || 0;
      const hours = Number(ow?.hours) || 0;
      const title = String(ow?.worktime_title || '').trim();
      const component = String(ow?.component_type || '').trim();

      if (!notes) {
        const key = `${title}__${hours}__${component}`;
        const idx = indexByKey.get(key);
        if (typeof idx === 'number') {
          out[idx] = { ...out[idx], quantity: (Number(out[idx]?.quantity) || 0) + qty };
          return;
        }
        indexByKey.set(key, out.length);
      }

      out.push(ow);
    });

    return out;
  }, [orderWorktimes]);

  const categoryLabelByKey = Object.fromEntries(
    selectionCategories.map((c) => [c.key, `${c.no}. ${c.label}`])
  );

  const worktimeHoursByCategory = orderWorktimes.reduce((acc, ow) => {
    const key = getWorktimeCategoryKey(ow, orderVehicleType);
    const add = (Number(ow?.hours) || 0) * (Number(ow?.quantity) || 0);
    acc[key] = (acc[key] || 0) + add;
    return acc;
  }, {});

  async function loadVehicleTypeForReg(regNumber) {
    if (!regNumber) return null;
    try {
      const res = await axios.get(
        `${getApiBaseUrl()}/vehicles/search?reg_number=${encodeURIComponent(regNumber)}`
      );
      const list = Array.isArray(res.data) ? res.data : [];
      const exact =
        list.find(
          (v) => String(v?.reg_number || '').toUpperCase() === String(regNumber).toUpperCase()
        ) || list[0];
      return exact?.vehicle_type || null;
    } catch {
      return null;
    }
  }

  const handleOrderClick = async (order) => {
    setSelectedOrder(order);
    const vt = (await loadVehicleTypeForReg(order?.reg_number)) || 'truck';
    setOrderVehicleType(vt);
    const firstKey = getCategoriesForVehicleType(vt)[0]?.key || 'regular';
    setWorktimeCategoryKey(firstKey);

    // Default to the first subgroup when the vehicle is a truck.
    const firstSubKey =
      vt === 'trailer' ? '' : (getSubcategoriesForCategoryKey(vt, firstKey)[0]?.key || '');
    setWorktimeSubcategoryKey(firstSubKey);

    loadOrderWorktimes(order.id);
    loadAvailableWorktimes();
    loadOrderPackages(order.id);
    loadAvailablePackages();
    setAddMode(canUseWorktimes ? 'worktimes' : (canUsePackages ? 'packages' : 'worktimes'));
    setOrderDetailsOpen(true);
  };

  const handleCloseOrderDetails = () => {
    setOrderDetailsOpen(false);
  };

  async function completeOrder(orderId) {
    if (!orderId) return;
    try {
      setCompleteLoading(true);
      await axios.put(`${getApiBaseUrl()}/orders/${orderId}/complete`);
      setCompleteConfirmOpen(false);
      setOrderDetailsOpen(false);
      setSelectedOrder(null);
      loadOrders();
    } catch (error) {
      alert('Грешка при приключване на поръчката');
    } finally {
      setCompleteLoading(false);
    }
  }

  async function loadAvailableWorktimes() {
    if (!canUseWorktimes) {
      setAvailableWorktimes([]);
      return;
    }
    try {
      const res = await axios.get(`${getApiBaseUrl()}/worktimes`);
      setAvailableWorktimes(res.data);
    } catch (error) {
      setAvailableWorktimes([]);
    }
  }

  async function loadAvailablePackages() {
    if (!canUsePackages) {
      setAvailablePackages([]);
      return;
    }
    try {
      const res = await axios.get(`${getApiBaseUrl()}/packages`);
      setAvailablePackages(res.data);
    } catch (error) {
      setAvailablePackages([]);
    }
  }

  // Keep the selected subgroup valid when category/vehicle type changes.
  useEffect(() => {
    if (orderVehicleType === 'trailer') {
      if (worktimeSubcategoryKey) setWorktimeSubcategoryKey('');
      return;
    }

    const list = getSubcategoriesForCategoryKey(orderVehicleType, worktimeCategoryKey);
    const keys = new Set(list.map((s) => s.key));
    const firstSub = list[0]?.key || '';

    // Force a subgroup selection when subgroups exist.
    if (!worktimeSubcategoryKey) {
      if (firstSub) setWorktimeSubcategoryKey(firstSub);
      return;
    }

    if (worktimeSubcategoryKey === '__legacy__') return;

    if (!keys.has(worktimeSubcategoryKey)) {
      setWorktimeSubcategoryKey(firstSub);
    }
  }, [orderVehicleType, worktimeCategoryKey, worktimeSubcategoryKey]);

  async function loadOrderWorktimes(orderId) {
    if (!canUseWorktimes) {
      setOrderWorktimes([]);
      return;
    }
    try {
      const res = await axios.get(`${getApiBaseUrl()}/orders/${orderId}/worktimes`);
      setOrderWorktimes(res.data);
    } catch (error) {
      setOrderWorktimes([]);
    }
  }

  async function loadOrderPackages(orderId) {
    if (!canUsePackages) {
      setOrderPackages([]);
      return;
    }
    try {
      const res = await axios.get(`${getApiBaseUrl()}/orders/${orderId}/packages`);
      setOrderPackages(res.data);
    } catch (error) {
      setOrderPackages([]);
    }
  }

  async function removeWorktimeFromOrder(orderWorktimeId) {
    try {
      await axios.delete(`${getApiBaseUrl()}/orders/worktimes/${orderWorktimeId}`);
      loadOrderWorktimes(selectedOrder.id);
    } catch (error) {
      alert('Грешка при премахване на нормовреме');
    }
  }

  async function removePackageFromOrder(orderPackageId) {
    try {
      await axios.delete(`${getApiBaseUrl()}/orders/packages/${orderPackageId}`);
      loadOrderPackages(selectedOrder.id);
    } catch (error) {
      alert('Грешка при премахване на пакетна операция');
    }
  }

  const handleWorktimeSelect = (worktime) => {
    if (!canUseWorktimes) return;
    // Auto-add the worktime, but keep the picker open so multiple items can be added quickly.
    addWorktimeToOrderWithDefaults(worktime, { keepPickerOpen: true });
  };

  async function addWorktimeToOrderWithDefaults(worktime, options = {}) {
    if (!canUseWorktimes) return;
    const { keepPickerOpen = false } = options;
    try {
      await axios.post(`${getApiBaseUrl()}/orders/${selectedOrder.id}/worktimes`, {
        worktime_id: worktime.id,
        quantity: worktimeForm.quantity,
        notes: worktimeForm.notes
      });
      loadOrderWorktimes(selectedOrder.id);

      // Keep quantity for rapid adding, but clear notes so they don't accidentally carry over.
      setWorktimeForm({ worktime_id: "", quantity: worktimeForm.quantity, notes: "" });

      if (!keepPickerOpen) {
        setWorktimeSelectionOpen(false);
        setWorktimeNavStep('category');
        setWorktimeSearch('');
      }
    } catch (error) {
      alert('Грешка при добавяне на нормовреме');
    }
  }

  // --- Packages flow ---
  const handlePackageSelect = (pkg) => {
    if (!canUsePackages) return;
    setSelectedPackageToAdd(pkg);
    const defaultUnitPrice = Number(pkg?.last_invoiced_price) || 0;
    setPackageForm((prev) => ({
      ...prev,
      price: String(defaultUnitPrice.toFixed(2)),
      is_price_correction: 0,
    }));
    setPackagePriceDialogOpen(true);
  };

  async function addPackageToOrderWithDefaults(pkg) {
    if (!canUsePackages) return;
    try {
      const unitPrice = Number(String(packageForm.price ?? '').replace(',', '.'));
      await axios.post(`${getApiBaseUrl()}/orders/${selectedOrder.id}/packages`, {
        package_id: pkg.id,
        quantity: Math.max(1, parseInt(packageForm.quantity, 10) || 1),
        notes: String(packageForm.notes || ''),
        price: Number.isFinite(unitPrice) ? unitPrice : 0,
        is_price_correction: Number(packageForm.is_price_correction) === 1 ? 1 : 0,
      });
      loadOrderPackages(selectedOrder.id);
      setPackagePriceDialogOpen(false);
      setPackageSelectionOpen(false);
      setSelectedPackageToAdd(null);
      setPackageSearch('');
      setPackageForm({ quantity: 1, notes: '', price: '', is_price_correction: 0 });
    } catch (error) {
      alert('Грешка при добавяне на пакетна операция');
    }
  }

  // Create package from inside the package picker modal
  const [packageCreateOpen, setPackageCreateOpen] = useState(false);
  const [packageCreateForm, setPackageCreateForm] = useState({ title: '', hours: '' });

  const createNewPackage = async () => {
    if (!canWritePackages) {
      alert('Нямате права за добавяне на пакетни операции.');
      return;
    }
    const title = String(packageCreateForm.title || '').trim();
    const hours = Number(String(packageCreateForm.hours || '').replace(',', '.'));
    if (!title) {
      alert('Моля въведете име');
      return;
    }
    if (!Number.isFinite(hours) || hours < 0) {
      alert('Моля въведете валидни часове');
      return;
    }

    try {
      const res = await axios.post(`${getApiBaseUrl()}/packages`, { title, hours });
      const created = res?.data;
      await loadAvailablePackages();
      setPackageCreateOpen(false);
      setPackageCreateForm({ title: '', hours: '' });

      // Convenience: if API returns the created package, auto-select it and open the price dialog.
      if (created?.id) {
        setSelectedPackageToAdd(created);
        const defaultUnitPrice = Number(created?.last_invoiced_price) || 0;
        setPackageForm((prev) => ({
          ...prev,
          price: String(defaultUnitPrice.toFixed(2)),
          is_price_correction: 0,
        }));
        setPackagePriceDialogOpen(true);
      }
    } catch (error) {
      alert('Грешка при създаване на пакетна операция');
    }
  };

  const openOrderPackageDetails = (op) => {
    if (!canUsePackages) return;
    setSelectedOrderPackage(op);
    setPackageEditDraft({
      quantity: Number(op?.quantity) || 1,
      notes: String(op?.notes || ''),
      price: String(op?.price ?? ''),
      is_price_correction: Number(op?.is_price_correction) === 1 ? 1 : 0,
    });
    setPackageDetailsOpen(true);
  };

  async function saveOrderPackageEdits() {
    if (!canUsePackages) return;
    if (!selectedOrder?.id || !selectedOrderPackage?.id) return;
    try {
      const unitPrice = Number(String(packageEditDraft.price ?? '').replace(',', '.'));
      const res = await axios.put(
        `${getApiBaseUrl()}/orders/${selectedOrder.id}/packages/${selectedOrderPackage.id}`,
        {
          quantity: Math.max(1, parseInt(packageEditDraft.quantity, 10) || 1),
          notes: String(packageEditDraft.notes || ''),
          price: Number.isFinite(unitPrice) ? unitPrice : 0,
          is_price_correction: Number(packageEditDraft.is_price_correction) === 1 ? 1 : 0,
        }
      );
      const updated = res.data;
      setSelectedOrderPackage(updated);
      setOrderPackages((prev) => (Array.isArray(prev) ? prev.map((x) => (x.id === updated.id ? updated : x)) : prev));
    } catch (error) {
      alert('Грешка при запис на пакетната операция');
    }
  }

  async function createNewWorktime() {
    if (!newWorktimeForm.title.trim() || !newWorktimeForm.hours || !newWorktimeForm.component_type) {
      alert('Моля попълнете всички полета: Наименование, Часове и Компонент');
      return;
    }

    const componentTypeForSave =
      orderVehicleType === 'trailer'
        ? newWorktimeForm.component_type
        : (String(newWorktimeForm.subcomponent_type || '').trim() || newWorktimeForm.component_type);

    try {
      const response = await axios.post(`${getApiBaseUrl()}/worktimes`, {
        title: newWorktimeForm.title,
        hours: newWorktimeForm.hours,
        component_type: componentTypeForSave,
        vehicle_type: orderVehicleType,
      });
      // Reload worktimes to include the new one
      await loadAvailableWorktimes();
      // Auto-select the newly created worktime
      setWorktimeForm({
        worktime_id: response.data.id,
        quantity: 1,
        notes: ""
      });
      setShowCreateWorktime(false);
      setNewWorktimeForm({
        title: "",
        hours: "",
        component_type: worktimeCategoryKey || getCategoriesForVehicleType(orderVehicleType)[0]?.key || 'regular',
        subcomponent_type: worktimeSubcategoryKey || (getSubcategoriesForCategoryKey(orderVehicleType, worktimeCategoryKey)[0]?.key || ''),
      });
    } catch (error) {
      alert('Грешка при създаване на нормовреме');
    }
  }

  const openNotesDialog = (worktime = null) => {
    if (worktime) {
      // Editing existing worktime notes
      setEditingWorktime(worktime);
      setNotesText(worktime.notes || "");
    } else {
      // Adding notes for new worktime
      setEditingWorktime(null);
      setNotesText(worktimeForm.notes || "");
    }
    setNotesDialogOpen(true);
  };

  const openOrderWorktimeDetails = (ow) => {
    setSelectedOrderWorktime(ow);
    setWorktimeDetailsOpen(true);
  };

  const saveNotes = async () => {
    if (editingWorktime) {
      // Update existing worktime notes
      try {
        const res = await axios.put(`${getApiBaseUrl()}/orders/${selectedOrder.id}/worktimes/${editingWorktime.id}`, {
          notes: notesText
        });

        // If the details popup is open for the same item, update it immediately.
        const updated = res?.data;
        if (updated && updated.id) {
          setSelectedOrderWorktime((prev) => (prev && prev.id === updated.id ? updated : prev));
        }
        loadOrderWorktimes(selectedOrder.id);
      } catch (error) {
        alert('Грешка при обновяване на бележките');
      }
    } else {
      // Set notes for new worktime
      setWorktimeForm({ ...worktimeForm, notes: notesText });
    }
    setNotesDialogOpen(false);
    setEditingWorktime(null);
    setNotesText("");
  };

  return (
    <Container
      maxWidth="xl"
      sx={{
        py: { xs: 2, md: 4 },
        px: { xs: 1.25, sm: 2.5 },
        // Avoid rare horizontal scrollbars due to long chips/buttons.
        overflowX: 'hidden',
      }}
    >
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AssignmentIcon />
        {t('ordersTitle')}
      </Typography>

      <Stack spacing={{ xs: 1.5, md: 2 }}>
        {/* Toolbar: search + create */}
        <Paper variant="outlined" sx={{ ...pageColumnSx, p: { xs: 1, sm: 1.5 }, borderRadius: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap alignItems={{ xs: 'stretch', md: 'center' }}>
            <TextField
              fullWidth
              placeholder="Търси по рег. номер или име на клиент..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') searchOrders();
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              variant="outlined"
            />

            <Button
              variant="contained"
              size={isMobile ? 'medium' : 'large'}
              startIcon={<AddTaskIcon />}
              onClick={() => {
                setForm({ client_id: null, client_name: "", reg_number: "", complaint: "" });
                setCreateDialogOpen(true);
              }}
              sx={{ whiteSpace: 'nowrap', minWidth: { xs: '100%', md: 240 } }}
            >
              {t('createOrder')}
            </Button>
          </Stack>
        </Paper>

        {/* Orders List */}
        <Card
          variant="outlined"
          sx={{
            ...pageColumnSx,
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            overflowX: 'hidden',
          }}
        >
          <CardContent
            sx={{
              display: 'flex',
              flexDirection: 'column',
              // Keep padding consistent with the toolbar.
              p: { xs: 1, sm: 1.5 },
            }}
          >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                  gap: 2,
                  flexWrap: 'wrap',
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Активни поръчки ({orders.length})
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
                    Покажи
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 80 }}>
                    <InputLabel id="orders-items-per-page" sx={{ display: 'none' }}>
                      Покажи
                    </InputLabel>
                    <Select
                      labelId="orders-items-per-page"
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(e.target.value)}
                    >
                      <MenuItem value={10}>10</MenuItem>
                      <MenuItem value={25}>25</MenuItem>
                      <MenuItem value={50}>50</MenuItem>
                      <MenuItem value={100}>100</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>

              {/* Card/List view for ALL screen sizes (requested), full width */}
              {/* Let the page scroll (no inner scrollbar), so widths match the search field exactly */}
              <Box sx={{ WebkitOverflowScrolling: 'touch' }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.25,
                    alignItems: 'stretch',
                  }}
                >
                  {orders.slice(0, itemsPerPage).map((o) => (
                    
                    <Card
                      key={o.id}
                      variant="outlined"
                      sx={{
                        borderRadius: 2,
                        overflow: 'hidden',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <CardActionArea
                        onClick={() => handleOrderClick(o)}
                        sx={{ p: { xs: 1.25, sm: 1.75 }, flex: 1, alignItems: 'stretch' }}
                      >
                        <Stack direction="row" spacing={1.25} alignItems="flex-start" justifyContent="space-between">
                          <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                              <AssignmentIcon color="primary" fontSize="small" />
                              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                                {o.reg_number}
                              </Typography>
                              <Chip label="Активна" color="success" size="small" />
                              <Chip label={`№ ${o.id}`} size="small" variant="outlined" />
                              <Chip
                                icon={<ScheduleIcon />}
                                label={`${Number(o?.total_hours || 0).toFixed(2).replace(/\.00$/, '')}ч`}
                                size="small"
                                color={Number(o?.total_hours || 0) > 0 ? 'primary' : 'default'}
                                variant={Number(o?.total_hours || 0) > 0 ? 'filled' : 'outlined'}
                                sx={{ fontWeight: 900 }}
                              />
                            </Stack>

                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontWeight: 700 }}>
                              Клиент: {o.client_name || '—'}
                            </Typography>

                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                mt: 0.25,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                minHeight: 20,
                              }}
                              title={o.complaint || ''}
                            >
                              Оплакване: {o.complaint ? o.complaint : '—'}
                            </Typography>

                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block', mt: 0.75, minHeight: 16 }}
                            >
                              Създадена: {o.created_at ? new Date(o.created_at).toLocaleString('bg-BG') : '—'}
                            </Typography>
                          </Box>
                        </Stack>
                      </CardActionArea>

                      <CardActions
                        sx={{
                          px: { xs: 1.25, sm: 1.75 },
                          pb: 1.25,
                          pt: 0.5,
                          justifyContent: 'flex-end',
                          minHeight: 56,
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'nowrap' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleOrderClick(o);
                            }}
                            sx={{ minHeight: 36, fontSize: '0.875rem', whiteSpace: 'nowrap' }}
                          >
                            Детайли
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              requestDeleteOrder(o);
                            }}
                            sx={{ minHeight: 36, fontSize: '0.875rem', whiteSpace: 'nowrap' }}
                          >
                            Изтрий
                          </Button>
                        </Stack>
                      </CardActions>
                    </Card>
                  ))}

                  {orders.length === 0 ? (
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, gridColumn: '1 / -1' }}>
                      <Typography sx={{ fontWeight: 900 }}>Няма активни поръчки</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Добавете първата поръчка или променете търсенето.
                      </Typography>
                    </Paper>
                  ) : null}
                </Box>
              </Box>
          </CardContent>
        </Card>
      </Stack>

      {/* Create order dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddTaskIcon color="primary" />
          {t('createOrder')}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('clientName')}
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('regNumber')}
                value={form.reg_number}
                onChange={(e) => setForm({ ...form, reg_number: e.target.value })}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('complaint')}
                value={form.complaint}
                onChange={(e) => setForm({ ...form, complaint: e.target.value })}
                variant="outlined"
                multiline
                rows={4}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateDialogOpen(false)}>Отказ</Button>
          <Button
            variant="contained"
            onClick={async () => {
              const ok = await createOrder();
              if (ok) setCreateDialogOpen(false);
            }}
            startIcon={<AddTaskIcon />}
          >
            {t('createOrderBtn')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog
        open={orderDetailsOpen}
        onClose={handleCloseOrderDetails}
        maxWidth="lg"
        fullWidth
        fullScreen={fullScreenDialog}
        sx={{
          '& .MuiDialog-paper': {
            border: (theme) => `3px solid ${theme.palette.mode === 'dark' ? '#555' : '#333'}`,
            borderRadius: 2,
            boxShadow: (theme) => theme.palette.mode === 'dark'
              ? '0 8px 32px rgba(0,0,0,0.6)'
              : '0 8px 32px rgba(0,0,0,0.3)',
          }
        }}
      >
        <DialogTitle
          sx={hcDialogTitleSx}
        >
          <IconButton
            onClick={handleCloseOrderDetails}
            sx={{ mr: 0.5 }}
            aria-label="Back"
          >
            <ArrowBackIcon />
          </IconButton>
          <AssignmentIcon sx={{ fontSize: '1.5rem' }} />
          Детайли на поръчка - {selectedOrder?.reg_number}
        </DialogTitle>
        <DialogContent sx={{ p: { xs: 1.25, sm: 2 } }}>
          {selectedOrder && (
            <Box sx={{ mb: 4 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: '1.25fr 0.75fr' },
                  gap: { xs: 1.25, sm: 2 },
                  alignItems: 'stretch',
                }}
              >
                <Paper variant="outlined" sx={hcSectionPaperSx}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1 }}>
                    Информация за поръчката
                  </Typography>
                  <Stack spacing={1}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800, minWidth: { sm: 140 } }}>
                        Рег. номер
                      </Typography>
                      <Chip label={selectedOrder.reg_number} color="primary" variant="outlined" sx={{ fontWeight: 900, width: 'fit-content' }} />
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800, minWidth: { sm: 140 } }}>
                        Клиент
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 800 }}>
                        {selectedOrder.client_name || '—'}
                      </Typography>
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800, minWidth: { sm: 140 }, mt: { sm: 0.5 } }}>
                        Оплакване
                      </Typography>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.25,
                          borderRadius: 2,
                          border: (theme) => `2px solid ${theme.palette.divider}`,
                          backgroundColor: (theme) => theme.palette.background.default,
                          flex: 1,
                        }}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {selectedOrder.complaint || '—'}
                        </Typography>
                      </Paper>
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800, minWidth: { sm: 140 } }}>
                        Създадена
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleDateString('bg-BG') : '—'}
                      </Typography>
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800, minWidth: { sm: 140 } }}>
                        Статус
                      </Typography>
                      <Chip
                        label={selectedOrder.status === 'active' ? 'Активна' : 'Завършена'}
                        color={selectedOrder.status === 'active' ? 'success' : 'default'}
                        size="small"
                        sx={{ fontWeight: 900, width: 'fit-content' }}
                      />
                    </Stack>
                  </Stack>
                </Paper>

                <Paper variant="outlined" sx={hcSectionPaperSx}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1 }}>
                    Статистика
                  </Typography>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: 1,
                      mb: 1.5,
                    }}
                  >
                    <Box sx={hcKpiBoxSx}>
                      <Typography variant="h5" sx={{ fontWeight: 900 }}>{totalWorktimesCount}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                        Нормовремена
                      </Typography>
                    </Box>
                    <Box sx={hcKpiBoxSx}>
                      <Typography variant="h5" sx={{ fontWeight: 900 }}>{totalWorktimesQuantity}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                        Количество
                      </Typography>
                    </Box>
                    <Box sx={hcKpiBoxSx}>
                      <Typography variant="h5" sx={{ fontWeight: 900 }}>{totalAllHours.toFixed(2).replace(/\.00$/, '')}ч</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                        Общо време
                      </Typography>
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 0.75 }}>
                    По категории
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {Object.entries(worktimeHoursByCategory)
                      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
                      .map(([categoryKey, hours]) => (
                        <Chip
                          key={categoryKey}
                          label={`${categoryLabelByKey[categoryKey] || categoryKey}: ${Number(hours || 0)
                            .toFixed(2)
                            .replace(/\.00$/, '')}ч`}
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 800 }}
                        />
                      ))}
                    {totalWorktimesCount === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                        Няма добавени нормовремена.
                      </Typography>
                    ) : null}
                  </Box>
                </Paper>
              </Box>
            </Box>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 1.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant={isMobile ? 'subtitle1' : 'h6'} sx={{ fontWeight: 900 }}>
                Добавени позиции
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
                ({addMode === 'worktimes' ? displayedOrderWorktimes.length : totalPackagesCount})
              </Typography>
            </Box>

            <Box sx={{ flexGrow: 1 }} />

            <ToggleButtonGroup
              value={addMode}
              exclusive
              onChange={(_, val) => {
                if (!val) return;
                setAddMode(val);
              }}
              size={isMobile ? 'small' : 'medium'}
            >
              <ToggleButton value="worktimes" disabled={!canUseWorktimes}>Нормовремена</ToggleButton>
              <ToggleButton value="packages" disabled={!canUsePackages}>Пакетни операции</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {addMode === 'worktimes' ? (
            displayedOrderWorktimes.length > 0 ? (
              <List dense sx={{ p: 0 }}>
                {displayedOrderWorktimes.map((ow, index) => {
                  const totalHours = (ow.hours || 0) * (ow.quantity || 0);
                  return (
                    <div key={ow.id}>
                      <ListItem
                        disablePadding
                        sx={{
                          borderRadius: 2,
                          overflow: 'hidden',
                          mb: 0.75,
                          border: (theme) =>
                            ow.notes
                              ? `2px solid ${theme.palette.warning.main}`
                              : `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        <ListItemText
                          onClick={() => openOrderWorktimeDetails(ow)}
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                {ow.worktime_title}
                              </Typography>
                              <Chip
                                label={`${totalHours.toFixed(2).replace(/\.00$/, '')}ч`}
                                size="small"
                                color="primary"
                                sx={{ fontWeight: 800 }}
                              />
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 0.25 }}>
                              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                                <Chip label={ow.component_type} size="small" variant="outlined" />
                                <Chip
                                  label={formatCategoryLabel(orderVehicleType, ow.component_type)}
                                  size="small"
                                  variant="outlined"
                                />
                                <Chip label={`${ow.hours}ч`} size="small" variant="outlined" />
                                <Chip label={`x${ow.quantity}`} size="small" variant="outlined" />
                                {ow.notes ? (
                                  <StickyNote2Icon
                                    titleAccess="Има бележка"
                                    sx={{ color: 'warning.main', fontSize: 18 }}
                                  />
                                ) : null}
                              </Box>
                              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                                Натисни за детайли
                              </Typography>
                            </Box>
                          }
                          sx={{
                            cursor: 'pointer',
                            px: 1.25,
                            py: 0.75,
                            '&:hover': { backgroundColor: 'action.hover' },
                          }}
                        />
                      </ListItem>
                      {index < displayedOrderWorktimes.length - 1 && <Divider sx={{ my: 0.25 }} />}
                    </div>
                  );
                })}
              </List>
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  p: { xs: 2, sm: 3 },
                  textAlign: 'center',
                  border: (theme) => `2px dashed ${theme.palette.divider}`,
                  borderRadius: 2,
                  backgroundColor: (theme) => theme.palette.background.default,
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 0.75 }}>
                  Няма добавени нормовремена
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                  Използвайте бутона "+" за да добавите нормовреме към поръчката.
                </Typography>
              </Paper>
            )
          ) : null}

          {addMode === 'packages' ? (
            orderPackages.length > 0 ? (
              <List dense sx={{ p: 0 }}>
                {orderPackages.map((op, index) => {
                  const hoursTotal = (Number(op?.hours) || 0) * (Number(op?.quantity) || 0);
                  const amountTotal = (Number(op?.price) || 0) * (Number(op?.quantity) || 0);
                  const hasNote = Boolean(String(op?.notes || '').trim());
                  const priceIsCorrection = Number(op?.is_price_correction) === 1;
                  return (
                    <div key={op.id}>
                      <ListItem
                        disablePadding
                        sx={{
                          borderRadius: 2,
                          overflow: 'hidden',
                          mb: 0.75,
                          border: (theme) =>
                            hasNote || priceIsCorrection
                              ? `2px solid ${theme.palette.warning.main}`
                              : `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        <ListItemText
                          onClick={() => openOrderPackageDetails(op)}
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                {op.package_title}
                              </Typography>
                              <Chip
                                label={`${amountTotal.toFixed(2)} лв`}
                                size="small"
                                color="primary"
                                sx={{ fontWeight: 900 }}
                              />
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 0.25 }}>
                              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                                <Chip label={`${Number(op?.hours || 0).toFixed(2).replace(/\.00$/, '')}ч`} size="small" variant="outlined" />
                                <Chip label={`x${op.quantity}`} size="small" variant="outlined" />
                                <Chip label={`${hoursTotal.toFixed(2).replace(/\.00$/, '')}ч общо`} size="small" variant="outlined" />
                                <Chip
                                  label={`${Number(op?.price || 0).toFixed(2)} лв/бр`}
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                  sx={{ fontWeight: 900 }}
                                />
                                {priceIsCorrection ? (
                                  <Chip label="Корекция" size="small" color="warning" variant="filled" sx={{ fontWeight: 900 }} />
                                ) : null}
                                {hasNote ? (
                                  <StickyNote2Icon titleAccess="Има бележка" sx={{ color: 'warning.main', fontSize: 18 }} />
                                ) : null}
                              </Box>
                              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                                Натисни за детайли
                              </Typography>
                            </Box>
                          }
                          sx={{
                            cursor: 'pointer',
                            px: 1.25,
                            py: 0.75,
                            '&:hover': { backgroundColor: 'action.hover' },
                          }}
                        />
                      </ListItem>
                      {index < orderPackages.length - 1 && <Divider sx={{ my: 0.25 }} />}
                    </div>
                  );
                })}
              </List>
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  p: { xs: 2, sm: 3 },
                  textAlign: 'center',
                  border: (theme) => `2px dashed ${theme.palette.divider}`,
                  borderRadius: 2,
                  backgroundColor: (theme) => theme.palette.background.default,
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 0.75 }}>
                  Няма добавени пакетни операции
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                  Използвайте бутона "+" за да добавите пакетна операция към поръчката.
                </Typography>
              </Paper>
            )
          ) : null}
        </DialogContent>
        <DialogActions sx={{
          p: { xs: 1.25, sm: 2 },
          pt: 0,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          backgroundColor: (theme) => theme.palette.background.paper,
          justifyContent: 'flex-end',
        }}>
          <IconButton
            onClick={() => setCompleteConfirmOpen(true)}
            disabled={!selectedOrder || completeLoading}
            title="Приключи поръчка"
            sx={{
              ml: 0.5,
              bgcolor: 'success.main',
              color: 'common.white',
              width: 44,
              height: 44,
              '&:hover': { bgcolor: 'success.dark' },
              '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
            }}
          >
            <TaskAltIcon />
          </IconButton>
        </DialogActions>

        {/* Floating Action Button for Adding Worktimes */}
        <Fab
          color="primary"
          aria-label="add worktime"
          onClick={() => {
            if (addMode === 'packages') {
              setPackageSearch('');
              setPackageForm({ quantity: 1, notes: '', price: '', is_price_correction: 0 });
              setSelectedPackageToAdd(null);
              setPackageSelectionOpen(true);
              return;
            }
            setWorktimeNavStep('category');
            setWorktimeSearch('');
            setWorktimeSelectionOpen(true);
          }}
          sx={{
            position: 'absolute',
            bottom: 80,
            right: 16,
            zIndex: 1000,
            width: 56,
            height: 56
          }}
        >
          <AddIcon />
        </Fab>
      </Dialog>

      {/* Popup: full details for a selected added package */}
      <Dialog
        open={packageDetailsOpen}
        onClose={() => setPackageDetailsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PaidIcon color="warning" />
            <Typography sx={{ fontWeight: 800 }}>
              {selectedOrderPackage?.package_title}
            </Typography>
          </Box>
          <IconButton onClick={() => setPackageDetailsOpen(false)} aria-label="Close">
            <ArrowBackIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedOrderPackage ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label={`${Number(selectedOrderPackage?.hours || 0).toFixed(2).replace(/\.00$/, '')}ч/бр`} size="small" variant="outlined" />
                <Chip label={`x${selectedOrderPackage?.quantity || 0}`} size="small" variant="outlined" />
                <Chip
                  label={`${(Number(selectedOrderPackage?.price || 0) * Number(selectedOrderPackage?.quantity || 0)).toFixed(2)} лв`}
                  size="small"
                  color="primary"
                  sx={{ fontWeight: 900 }}
                />
                {Number(selectedOrderPackage?.is_price_correction) === 1 ? (
                  <Chip label="Корекция" size="small" color="warning" sx={{ fontWeight: 900 }} />
                ) : null}
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Количество"
                    type="number"
                    size="small"
                    value={packageEditDraft.quantity}
                    onChange={(e) => setPackageEditDraft((p) => ({ ...p, quantity: parseInt(e.target.value, 10) || 1 }))}
                    inputProps={{ min: 1 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Цена (лв/бр)"
                    size="small"
                    value={packageEditDraft.price}
                    onChange={(e) => setPackageEditDraft((p) => ({ ...p, price: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Бележки"
                    size="small"
                    value={packageEditDraft.notes}
                    onChange={(e) => setPackageEditDraft((p) => ({ ...p, notes: e.target.value }))}
                    multiline
                    minRows={3}
                  />
                </Grid>
              </Grid>

              <FormControlLabel
                control={
                  <Switch
                    checked={Number(packageEditDraft.is_price_correction) === 1}
                    onChange={(e) => setPackageEditDraft((p) => ({ ...p, is_price_correction: e.target.checked ? 1 : 0 }))}
                  />
                }
                label="Корекция на цена (ако е по-ниска от последната фактура)"
              />
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={saveOrderPackageEdits} disabled={!selectedOrderPackage} variant="outlined" startIcon={<EditIcon />}>
            Запази
          </Button>
          <Button
            onClick={() => {
              if (!selectedOrderPackage) return;
              removePackageFromOrder(selectedOrderPackage.id);
              setPackageDetailsOpen(false);
            }}
            color="error"
            startIcon={<DeleteIcon />}
            disabled={!selectedOrderPackage}
          >
            Премахни
          </Button>
        </DialogActions>
      </Dialog>

      {/* Popup: full details for a selected added worktime */}
      <Dialog
        open={worktimeDetailsOpen}
        onClose={() => setWorktimeDetailsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScheduleIcon color="primary" />
            <Typography sx={{ fontWeight: 800 }}>
              {selectedOrderWorktime?.worktime_title}
            </Typography>
          </Box>
          <IconButton onClick={() => setWorktimeDetailsOpen(false)} aria-label="Close">
            <ArrowBackIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedOrderWorktime && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label={`Компонент: ${selectedOrderWorktime.component_type}`} size="small" />
                <Chip
                  label={`Категория: ${formatCategoryLabel(orderVehicleType, selectedOrderWorktime.component_type)}`}
                  size="small"
                />
                <Chip label={`Време: ${selectedOrderWorktime.hours}ч`} size="small" />
                <Chip label={`Количество: x${selectedOrderWorktime.quantity}`} size="small" />
                <Chip
                  label={`Общо: ${(selectedOrderWorktime.hours * selectedOrderWorktime.quantity).toFixed(2).replace(/\.00$/, '')}ч`}
                  size="small"
                  color="primary"
                  sx={{ fontWeight: 800 }}
                />
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
                  Бележки
                </Typography>
                <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {selectedOrderWorktime.notes ? selectedOrderWorktime.notes : '—'}
                  </Typography>
                </Paper>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (selectedOrderWorktime) openNotesDialog(selectedOrderWorktime);
            }}
            startIcon={<EditIcon />}
            disabled={!selectedOrderWorktime}
          >
            Редактирай бележки
          </Button>
          <Button
            onClick={() => {
              if (!selectedOrderWorktime) return;
              removeWorktimeFromOrder(selectedOrderWorktime.id);
              setWorktimeDetailsOpen(false);
            }}
            color="error"
            startIcon={<DeleteIcon />}
            disabled={!selectedOrderWorktime}
          >
            Премахни
          </Button>
        </DialogActions>
      </Dialog>

      {/* Package Selection Modal */}
      <Dialog
        open={packageSelectionOpen}
        onClose={() => setPackageSelectionOpen(false)}
        maxWidth="lg"
        fullWidth
        fullScreen={fullScreenDialog}
        sx={{
          '& .MuiDialog-paper': {
            border: (theme) => `3px solid ${theme.palette.mode === 'dark' ? '#555' : '#333'}`,
            borderRadius: 2,
            boxShadow: (theme) => theme.palette.mode === 'dark'
              ? '0 8px 32px rgba(0,0,0,0.6)'
              : '0 8px 32px rgba(0,0,0,0.3)',
          }
        }}
      >
        <DialogTitle sx={hcDialogTitleSx}>
          <Box sx={{ width: 40 }} />
          <AddIcon sx={{ fontSize: '1.5rem' }} />
          Избери пакетна операция за добавяне
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              placeholder="Търси пакетна операция..."
              value={packageSearch}
              onChange={(e) => setPackageSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: (theme) => theme.palette.primary.main }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Box sx={{ mb: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
              Настройки за добавяне:
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Количество"
                  type="number"
                  value={packageForm.quantity}
                  onChange={(e) => setPackageForm((p) => ({ ...p, quantity: parseInt(e.target.value, 10) || 1 }))}
                  inputProps={{ min: 1 }}
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Бележки"
                  value={packageForm.notes}
                  onChange={(e) => setPackageForm((p) => ({ ...p, notes: e.target.value }))}
                  size="small"
                />
              </Grid>
            </Grid>
          </Box>

          {/* Create new package directly from this modal */}
          <Card
            variant="outlined"
            sx={{
              mb: 2,
              borderRadius: 2,
              borderStyle: 'dashed',
              backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#2a2a2a' : '#ffffff',
            }}
          >
            <CardActionArea
              onClick={() => {
                if (!canWritePackages) {
                  alert('Нямате права за добавяне на пакетни операции.');
                  return;
                }
                setPackageCreateOpen(true);
              }}
              sx={{ p: 1.5 }}
              disabled={!canWritePackages}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 900 }}>+ Нова пакетна операция</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                    Създай операция без да излизаш от работната карта.
                  </Typography>
                </Box>
                <Chip
                  label={canWritePackages ? 'Създай' : 'Без права'}
                  color={canWritePackages ? 'primary' : 'default'}
                  size="small"
                  sx={{ fontWeight: 900, flexShrink: 0 }}
                />
              </Box>
            </CardActionArea>
          </Card>

          <List sx={{ p: 0 }}>
            {(Array.isArray(availablePackages) ? availablePackages : [])
              .filter((p) => {
                const q = String(packageSearch || '').trim().toLowerCase();
                if (!q) return true;
                return String(p?.title || '').toLowerCase().includes(q);
              })
              .map((pkg, index, arr) => {
                const lastPrice = Number(pkg?.last_invoiced_price) || 0;
                const lastAt = String(pkg?.last_invoiced_at || '').trim();
                const lastAtBg = lastAt ? new Date(String(lastAt).replace(' ', 'T')).toLocaleDateString('bg-BG') : '';

                return (
                  <div key={pkg.id}>
                    <ListItem
                      alignItems="flex-start"
                      button
                      onClick={() => handlePackageSelect(pkg)}
                      sx={{
                        cursor: 'pointer',
                        borderRadius: 2,
                        mb: 1.25,
                        border: (theme) => `2px solid ${theme.palette.mode === 'dark' ? '#555' : '#ccc'}`,
                        backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#333' : '#fff',
                        padding: 2,
                        '&:hover': {
                          borderColor: (theme) => theme.palette.primary.main,
                          transform: 'translateY(-1px)',
                          boxShadow: (theme) => theme.palette.mode === 'dark'
                            ? '0 6px 12px rgba(0,0,0,0.4)'
                            : '0 6px 12px rgba(0,0,0,0.15)',
                        },
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                              <PaidIcon color="warning" sx={{ fontSize: '1.5rem' }} />
                              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                {pkg.title}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                              <Chip label={`${Number(pkg.hours || 0).toFixed(2).replace(/\.00$/, '')} ч.`} size="small" variant="outlined" />
                              <Tooltip
                                title={lastAtBg ? `Последно фактуриране: ${lastAtBg}` : 'Няма фактуриране'}
                                arrow
                              >
                                <Chip
                                  label={`${lastPrice.toFixed(2)} лв.`}
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                  sx={{ fontWeight: 900 }}
                                />
                              </Tooltip>
                            </Box>
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            Натисни за избор и цена.
                          </Typography>
                        }
                      />
                    </ListItem>
                    {index < arr.length - 1 ? <Divider sx={{ my: 0.5 }} /> : null}
                  </div>
                );
              })}

            {Array.isArray(availablePackages) && availablePackages.length === 0 ? (
              <ListItem>
                <ListItemText
                  primary="Няма пакетни операции"
                  secondary={canWritePackages ? 'Създайте първата с „Нова пакетна операция“ по-горе.' : 'Нямате права за създаване (packages:write).'}
                />
              </ListItem>
            ) : null}
          </List>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setPackageSelectionOpen(false)} variant="outlined">
            Отказ
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create package dialog (from picker) */}
      <Dialog open={packageCreateOpen} onClose={() => setPackageCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddIcon />
          Нова пакетна операция
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Име *"
                value={packageCreateForm.title}
                onChange={(e) => setPackageCreateForm((p) => ({ ...p, title: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Часове *"
                value={packageCreateForm.hours}
                onChange={(e) => setPackageCreateForm((p) => ({ ...p, hours: e.target.value }))}
                type="number"
                inputProps={{ min: 0, step: '0.1' }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPackageCreateOpen(false)}>Отказ</Button>
          <Button onClick={createNewPackage} variant="contained" disabled={!canWritePackages}>
            Създай
          </Button>
        </DialogActions>
      </Dialog>

      {/* Package price dialog */}
      <Dialog
        open={packagePriceDialogOpen}
        onClose={() => setPackagePriceDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PaidIcon color="warning" />
          Цена на пакетна операция
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedPackageToAdd ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography sx={{ fontWeight: 900 }}>{selectedPackageToAdd.title}</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label={`${Number(selectedPackageToAdd.hours || 0).toFixed(2).replace(/\.00$/, '')}ч`} size="small" variant="outlined" />
                <Tooltip
                  title={selectedPackageToAdd?.last_invoiced_at
                    ? `Последно фактуриране: ${new Date(String(selectedPackageToAdd.last_invoiced_at).replace(' ', 'T')).toLocaleString('bg-BG')}`
                    : 'Няма фактуриране'}
                  arrow
                >
                  <Chip
                    label={`${Number(selectedPackageToAdd?.last_invoiced_price || 0).toFixed(2)} лв (последна)`}
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ fontWeight: 900 }}
                  />
                </Tooltip>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Количество"
                    type="number"
                    size="small"
                    value={packageForm.quantity}
                    onChange={(e) => setPackageForm((p) => ({ ...p, quantity: parseInt(e.target.value, 10) || 1 }))}
                    inputProps={{ min: 1 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Цена (лв/бр)"
                    size="small"
                    value={packageForm.price}
                    onChange={(e) => setPackageForm((p) => ({ ...p, price: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Бележки"
                    size="small"
                    value={packageForm.notes}
                    onChange={(e) => setPackageForm((p) => ({ ...p, notes: e.target.value }))}
                    multiline
                    minRows={3}
                  />
                </Grid>
              </Grid>

              <FormControlLabel
                control={
                  <Switch
                    checked={Number(packageForm.is_price_correction) === 1}
                    onChange={(e) => setPackageForm((p) => ({ ...p, is_price_correction: e.target.checked ? 1 : 0 }))}
                  />
                }
                label="Корекция на цена (ако зададете по-ниска цена)"
              />
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPackagePriceDialogOpen(false)}>Отказ</Button>
          <Button
            onClick={() => {
              if (!selectedPackageToAdd) return;
              addPackageToOrderWithDefaults(selectedPackageToAdd);
            }}
            variant="contained"
            color="warning"
            disabled={!selectedPackageToAdd}
          >
            Добави
          </Button>
        </DialogActions>
      </Dialog>

      {/* Complete order confirmation */}
      <Dialog
        open={completeConfirmOpen}
        onClose={() => setCompleteConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Потвърждение</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            Сигурни ли сте, че искате да приключите поръчката?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Поръчка: <strong>{selectedOrder?.reg_number}</strong>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompleteConfirmOpen(false)} disabled={completeLoading}>
            Отказ
          </Button>
          <Button
            onClick={() => completeOrder(selectedOrder?.id)}
            variant="contained"
            color="success"
            disabled={!selectedOrder || completeLoading}
            startIcon={<TaskAltIcon />}
          >
            Потвърди
          </Button>
        </DialogActions>
      </Dialog>

      {/* Worktime Selection Modal */}
      <Dialog
        open={worktimeSelectionOpen}
        onClose={() => setWorktimeSelectionOpen(false)}
        maxWidth="lg"
        fullWidth
        fullScreen={fullScreenDialog}
        sx={{
          '& .MuiDialog-paper': {
            border: (theme) => `3px solid ${theme.palette.mode === 'dark' ? '#555' : '#333'}`,
            borderRadius: 2,
            boxShadow: (theme) => theme.palette.mode === 'dark'
              ? '0 8px 32px rgba(0,0,0,0.6)'
              : '0 8px 32px rgba(0,0,0,0.3)',
          }
        }}
      >
        <DialogTitle sx={hcDialogTitleSx}>
          {worktimeNavStep !== 'category' ? (
            <IconButton
              onClick={() => {
                if (worktimeNavStep === 'worktimes' && orderVehicleType !== 'trailer') {
                  setWorktimeNavStep('subcategory');
                  return;
                }
                // Back to group selection
                setWorktimeNavStep('category');
                setWorktimeSubcategoryKey('');
              }}
              sx={{ mr: 0.5 }}
              aria-label="Back"
            >
              <ArrowBackIcon />
            </IconButton>
          ) : (
            // Keep title alignment
            <Box sx={{ width: 40 }} />
          )}
          <AddIcon sx={{ fontSize: '1.5rem' }} />
          Избери нормовреме за добавяне
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {/* Step 1: Group (cards) */}
          {worktimeNavStep === 'category' ? (
            <Box
              sx={{
                borderBottom: (theme) => `2px solid ${theme.palette.mode === 'dark' ? '#555' : '#ccc'}`,
                backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#2a2a2a' : '#f8f8f8',
                p: 2,
              }}
            >
              <Typography sx={{ fontWeight: 800, mb: 1 }}>
                Главна група ({orderVehicleType === 'trailer' ? 'Ремарке' : 'Автомобил'})
              </Typography>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
                  gap: 1,
                  alignItems: 'stretch',
                }}
              >
                {selectionCategories.map((cat) => {
                  const isActive = worktimeCategoryKey === cat.key;
                  const count = (availableWorktimes || []).filter(
                    (w) => getWorktimeCategoryKey(w, orderVehicleType) === cat.key
                  ).length;
                  return (
                    <Card
                      key={cat.key}
                      variant="outlined"
                      sx={(theme) => ({
                        borderRadius: 2,
                        borderWidth: isActive ? 2 : 1,
                        borderColor: isActive ? theme.palette.primary.main : theme.palette.divider,
                        overflow: 'hidden',
                      })}
                    >
                      <CardActionArea
                        onClick={() => {
                          setWorktimeCategoryKey(cat.key);
                          setWorktimeSearch('');

                          if (orderVehicleType === 'trailer') {
                            setWorktimeSubcategoryKey('');
                            setWorktimeNavStep('worktimes');
                            return;
                          }

                          const firstSub =
                            getSubcategoriesForCategoryKey(orderVehicleType, cat.key)[0]?.key || '';
                          setWorktimeSubcategoryKey(firstSub);
                          setWorktimeNavStep('subcategory');
                        }}
                        sx={{ p: 1.25 }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 900 }}>{cat.no}. {cat.label}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                              Главна група
                            </Typography>
                          </Box>
                          <Chip label={count} size="small" sx={{ fontWeight: 900 }} />
                        </Box>
                      </CardActionArea>
                    </Card>
                  );
                })}
              </Box>
            </Box>
          ) : null}

          {/* Step 2: Subgroup (cards, trucks only) */}
          {worktimeNavStep === 'subcategory' && orderVehicleType !== 'trailer' ? (
            <Box
              sx={{
                borderBottom: (theme) => `2px solid ${theme.palette.mode === 'dark' ? '#555' : '#ccc'}`,
                backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#2a2a2a' : '#f8f8f8',
                p: 2,
              }}
            >
              <Typography sx={{ fontWeight: 800, mb: 1 }}>
                Подгрупа
              </Typography>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1,
                  alignItems: 'stretch',
                }}
              >
                {selectionSubcategoriesWithLegacy.map((sub) => {
                  const isActive = worktimeSubcategoryKey === sub.key;
                  const count = countBySelectionSubcategoryKey[sub.key] || 0;
                  return (
                    <Card
                      key={sub.key}
                      variant="outlined"
                      sx={(theme) => ({
                        borderRadius: 2,
                        borderWidth: isActive ? 2 : 1,
                        borderColor: isActive ? theme.palette.primary.main : theme.palette.divider,
                        overflow: 'hidden',
                      })}
                    >
                      <CardActionArea
                        onClick={() => {
                          setWorktimeSubcategoryKey(sub.key);
                          setWorktimeSearch('');
                          setWorktimeNavStep('worktimes');
                        }}
                        sx={{ p: 1.25 }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 900 }} title={sub.label}>
                              {sub.key === '__legacy__' ? String(sub.label) : `${sub.no}. ${sub.label}`}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                              Подгрупа
                            </Typography>
                          </Box>
                          <Chip
                            label={count}
                            size="small"
                            color="primary"
                            sx={{ fontWeight: 900, flexShrink: 0 }}
                          />
                        </Box>
                      </CardActionArea>
                    </Card>
                  );
                })}
              </Box>
            </Box>
          ) : null}

          {/* Step 3: Worktimes */}
          {worktimeNavStep === 'worktimes' ? (
          <Box sx={{ p: 3 }}>
            {/* Info tile: how worktimes are calculated */}
            <Card
              variant="outlined"
              sx={{
                mb: 2,
                borderRadius: 2,
                borderStyle: 'dashed',
                backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#2a2a2a' : '#ffffff',
              }}
            >
              <CardActionArea onClick={() => setWorktimeInfoOpen(true)} sx={{ p: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <InfoOutlinedIcon color="info" />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 900 }}>
                        Как се изчислява нормовремето?
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                        Натисни за кратко обяснение и пример.
                      </Typography>
                    </Box>
                  </Box>
                  <Chip label="Инфо" color="info" size="small" sx={{ fontWeight: 900, flexShrink: 0 }} />
                </Box>
              </CardActionArea>
            </Card>

            {/* Mobile Tab Indicator */}
            <Box sx={{ display: { xs: 'block', sm: 'none' }, mb: 2 }}>
              <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                📋 {formatCategoryLabel(orderVehicleType, worktimeCategoryKey)}
                {orderVehicleType !== 'trailer' && worktimeSubcategoryKey ? (
                  <>
                    {' '} / {worktimeSubcategoryKey === '__legacy__' ? 'Неразпределени' : worktimeSubcategoryKey}
                  </>
                ) : null}
              </Typography>
            </Box>

            {/* Search */}
            <TextField
              fullWidth
              placeholder="Търси нормовреме..."
              value={worktimeSearch}
              onChange={(e) => setWorktimeSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: (theme) => theme.palette.primary.main }} />
                  </InputAdornment>
                ),
              }}
              variant="outlined"
              sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#333' : '#fff',
                  border: (theme) => `2px solid ${theme.palette.mode === 'dark' ? '#555' : '#ccc'}`,
                  '& fieldset': {
                    border: 'none'
                  },
                  '&:hover': {
                    borderColor: (theme) => theme.palette.primary.main,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  },
                  '&.Mui-focused': {
                    borderColor: (theme) => theme.palette.primary.main,
                    boxShadow: `0 0 0 3px ${(theme) => theme.palette.primary.main}30`
                  }
                }
              }}
            />

            <Typography variant="body1" gutterBottom sx={{ mb: 2 }}>
              Изберете нормовреме от списъка по-долу. То ще бъде добавено към поръчката, а прозорецът ще остане отворен,
              за да добавяте и други позиции.
            </Typography>

            {/* Quantity and Notes Button */}
            <Box sx={{ mb: 3, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                Настройки за добавяне:
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Количество"
                    type="number"
                    value={worktimeForm.quantity}
                    onChange={(e) => setWorktimeForm({ ...worktimeForm, quantity: parseInt(e.target.value) || 1 })}
                    inputProps={{ min: 1 }}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => openNotesDialog()}
                    size="small"
                    sx={{ height: '40px' }}
                  >
                    📝 {worktimeForm.notes ? 'Бележки ✓' : 'Добави бележки'}
                  </Button>
                </Grid>
              </Grid>
            </Box>

            {/* Add New Worktime Button */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<AddIcon sx={{ fontSize: '1.2rem' }} />}
                onClick={() => setShowCreateWorktime(true)}
                sx={{
                  border: (theme) => `2px solid ${theme.palette.primary.main}`,
                  color: (theme) => theme.palette.primary.main,
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  padding: '12px 24px',
                  borderRadius: 2,
                  backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#333' : '#fff',
                  '&:hover': {
                    borderColor: (theme) => theme.palette.primary.dark,
                    backgroundColor: (theme) => theme.palette.primary.main,
                    color: 'white',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }
                }}
              >
                Добави ново нормовреме
              </Button>
            </Box>

            <List sx={{ p: 0 }}>
              {filteredAvailableWorktimes.map((worktime, index) => (
                <div key={worktime.id}>
                    <ListItem
                      alignItems="flex-start"
                      button
                      onClick={() => handleWorktimeSelect(worktime)}
                      sx={{
                        cursor: 'pointer',
                        borderRadius: 2,
                        mb: 1.5,
                        border: (theme) => `2px solid ${theme.palette.mode === 'dark' ? '#555' : '#ccc'}`,
                        backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#333' : '#fff',
                        transition: 'all 0.3s ease-in-out',
                        padding: 2,
                        '&:hover': {
                          backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#444' : '#f5f5f5',
                          borderColor: (theme) => theme.palette.primary.main,
                          transform: 'translateY(-2px)',
                          boxShadow: (theme) => theme.palette.mode === 'dark'
                            ? '0 6px 12px rgba(0,0,0,0.4)'
                            : '0 6px 12px rgba(0,0,0,0.15)',
                        },
                        '&:active': {
                          transform: 'translateY(-1px)',
                          boxShadow: (theme) => theme.palette.mode === 'dark'
                            ? '0 3px 6px rgba(0,0,0,0.3)'
                            : '0 3px 6px rgba(0,0,0,0.1)',
                        }
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <ScheduleIcon
                                color="primary"
                                sx={{
                                  fontSize: '1.5rem',
                                  color: (theme) => theme.palette.primary.main
                                }}
                              />
                              <Typography
                                variant="h6"
                                sx={{
                                  fontWeight: 'bold',
                                  color: (theme) => theme.palette.mode === 'dark' ? '#fff' : '#333'
                                }}
                              >
                                {worktime.title}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip
                                label={`${worktime.hours} ч.`}
                                color="secondary"
                                size="small"
                                sx={{
                                  fontWeight: 'bold',
                                  border: (theme) => `1px solid ${theme.palette.secondary.main}`,
                                  backgroundColor: (theme) => theme.palette.secondary.main + '20'
                                }}
                              />
                              <AddIcon
                                sx={{
                                  color: (theme) => theme.palette.primary.main,
                                  fontSize: '1.2rem',
                                  fontWeight: 'bold'
                                }}
                              />
                            </Box>
                          </Box>
                        }
                        secondary={
                          <Typography
                            variant="body2"
                            sx={{
                              color: (theme) => theme.palette.mode === 'dark' ? '#ccc' : '#666',
                              fontStyle: 'italic',
                              mt: 0.5
                            }}
                          >
                            Стандартно време за изпълнение на дейността
                          </Typography>
                        }
                      />
                    </ListItem>
                    {index < filteredAvailableWorktimes.length - 1 && (
                      <Divider sx={{
                        borderColor: (theme) => theme.palette.mode === 'dark' ? '#555' : '#ddd',
                        my: 1
                      }} />
                    )}
                  </div>
                ))}

              {filteredAvailableWorktimes.length === 0 && (
                <ListItem sx={{
                  border: (theme) => `2px dashed ${theme.palette.mode === 'dark' ? '#666' : '#ccc'}`,
                  borderRadius: 2,
                  backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#2a2a2a' : '#f9f9f9',
                  p: 3,
                  textAlign: 'center'
                }}>
                  <ListItemText
                    primary={
                      <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>
                        📭 Няма нормовремена за избраната подгрупа
                      </Typography>
                    }
                    secondary={
                      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                        Добавете нормовремена в раздел „Нормовремена"
                      </Typography>
                    }
                  />
                </ListItem>
              )}
            </List>
          </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{
          p: 3,
          pt: 0,
          borderTop: (theme) => `2px solid ${theme.palette.mode === 'dark' ? '#555' : '#ccc'}`,
          backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#2a2a2a' : '#f8f8f8'
        }}>
          <Button
            onClick={() => setWorktimeSelectionOpen(false)}
            variant="outlined"
            sx={{
              border: (theme) => `2px solid ${theme.palette.mode === 'dark' ? '#666' : '#999'}`,
              color: (theme) => theme.palette.mode === 'dark' ? '#ccc' : '#666',
              fontWeight: 'bold',
              '&:hover': {
                borderColor: (theme) => theme.palette.error.main,
                color: (theme) => theme.palette.error.main,
                backgroundColor: (theme) => theme.palette.error.main + '10'
              }
            }}
          >
            Отказ
          </Button>
        </DialogActions>
      </Dialog>

      {/* Worktime info popup */}
      <Dialog
        open={worktimeInfoOpen}
        onClose={() => setWorktimeInfoOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 900 }}>
          <InfoOutlinedIcon color="info" />
          Информация за нормовремената
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography sx={{ fontWeight: 800, mb: 1.25 }}>
            Какво е „нормовреме“?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700, mb: 2 }}>
            Нормовремето е стандартно време (в часове) за изпълнение на конкретна дейност.
            Използва се за изчисляване на общото време по работната карта.
          </Typography>

          <Divider sx={{ my: 1.5 }} />

          <Typography sx={{ fontWeight: 800, mb: 1 }}>
            Как се изчислява общото време?
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
            <li>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Време за позиция = <strong>часове (нормовреме)</strong> × <strong>количество</strong>
              </Typography>
            </li>
            <li>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Общо време по поръчката = сума от времената за всички позиции
              </Typography>
            </li>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700, mt: 1.25 }}>
            Пример: 1.5ч × 2 = 3.0ч общо за позицията.
          </Typography>

          <Divider sx={{ my: 1.5 }} />

          <Typography sx={{ fontWeight: 800, mb: 1 }}>
            Бележки и групиране
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
            Ако добавиш бележка към позиция, тя служи като допълнителна информация за изпълнението.
            (Позициите с различни бележки се третират като отделни редове.)
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setWorktimeInfoOpen(false)} variant="contained">
            Разбрах
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create New Worktime Dialog */}
      <Dialog open={showCreateWorktime} onClose={() => setShowCreateWorktime(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddIcon />
          Добави ново нормовреме
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Категория *</InputLabel>
                <Select
                  value={newWorktimeForm.component_type}
                  onChange={(e) => {
                    const catKey = e.target.value;
                    const firstSub =
                      orderVehicleType === 'trailer'
                        ? ''
                        : (getSubcategoriesForCategoryKey(orderVehicleType, catKey)[0]?.key || '');
                    setNewWorktimeForm({
                      ...newWorktimeForm,
                      component_type: catKey,
                      subcomponent_type: firstSub,
                    });
                  }}
                  label="Категория *"
                  required
                >
                  {getCategoriesForVehicleType(orderVehicleType).map((cat) => (
                    <MenuItem key={cat.key} value={cat.key}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={cat.no} size="small" sx={{ fontWeight: 900, minWidth: 34 }} />
                        {cat.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {orderVehicleType !== 'trailer' ? (
              <Grid item xs={12}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Подгрупа</InputLabel>
                  <Select
                    value={newWorktimeForm.subcomponent_type}
                    onChange={(e) => setNewWorktimeForm({ ...newWorktimeForm, subcomponent_type: e.target.value })}
                    label="Подгрупа"
                  >
                    {getSubcategoriesForCategoryKey(orderVehicleType, newWorktimeForm.component_type).map((sub) => (
                      <MenuItem key={sub.key} value={sub.key}>
                        {sub.no}. {sub.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            ) : null}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Наименование на дейността *"
                value={newWorktimeForm.title}
                onChange={(e) => setNewWorktimeForm({ ...newWorktimeForm, title: e.target.value })}
                variant="outlined"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Нормовреме (часове) *"
                value={newWorktimeForm.hours}
                onChange={(e) => setNewWorktimeForm({ ...newWorktimeForm, hours: e.target.value })}
                variant="outlined"
                type="number"
                step="0.1"
                inputProps={{ min: 0 }}
                required
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateWorktime(false)}>Отказ</Button>
          <Button onClick={createNewWorktime} variant="contained" startIcon={<AddIcon />}>
            Създай нормовреме
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onClose={() => setNotesDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon />
          {editingWorktime ? 'Редактирай бележки' : 'Добави бележки'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Бележки"
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Въведете допълнителни бележки..."
            variant="outlined"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotesDialogOpen(false)}>Отказ</Button>
          <Button onClick={saveNotes} variant="contained" startIcon={<EditIcon />}>
            Запази
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete order confirmation */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => {
          if (deleteLoading) return;
          setDeleteConfirmOpen(false);
          setOrderToDelete(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Потвърждение</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            Сигурни ли сте, че искате да изтриете тази работна карта?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Рег. №: <strong>{orderToDelete?.reg_number || '—'}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Клиент: <strong>{orderToDelete?.client_name || '—'}</strong>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteConfirmOpen(false);
              setOrderToDelete(null);
            }}
            disabled={deleteLoading}
          >
            Отказ
          </Button>
          <Button
            onClick={confirmDeleteOrder}
            variant="contained"
            color="error"
            disabled={!orderToDelete?.id || deleteLoading}
            startIcon={<DeleteIcon />}
          >
            {deleteLoading ? 'Изтриване...' : 'Изтрий'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
