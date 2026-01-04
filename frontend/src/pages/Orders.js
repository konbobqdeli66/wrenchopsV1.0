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
  Stack
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
import { getApiBaseUrl } from "../api";
import {
  formatCategoryLabel,
  getCategoriesForVehicleType,
  getWorktimeCategoryKey,
} from "../utils/worktimeClassification";

export default function Orders({ t }) {
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
  const [orderVehicleType, setOrderVehicleType] = useState('truck');
  const [worktimeCategoryKey, setWorktimeCategoryKey] = useState('regular');
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
    component_type: "regular"
  });
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [editingWorktime, setEditingWorktime] = useState(null);
  const [notesText, setNotesText] = useState("");
  const [worktimeDetailsOpen, setWorktimeDetailsOpen] = useState(false);
  const [selectedOrderWorktime, setSelectedOrderWorktime] = useState(null);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Make dialogs fullscreen on desktop (requested) and also on mobile.
  const isDesktop = useMediaQuery('(min-width:900px)');
  const isMobile = useMediaQuery('(max-width:600px)');
  const fullScreenDialog = isDesktop || isMobile;

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
    loadOrderWorktimes(order.id);
    loadAvailableWorktimes();
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
    try {
      const res = await axios.get(`${getApiBaseUrl()}/worktimes`);
      setAvailableWorktimes(res.data);
    } catch (error) {
      setAvailableWorktimes([]);
    }
  }

  async function loadOrderWorktimes(orderId) {
    try {
      const res = await axios.get(`${getApiBaseUrl()}/orders/${orderId}/worktimes`);
      setOrderWorktimes(res.data);
    } catch (error) {
      setOrderWorktimes([]);
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

  const handleWorktimeSelect = (worktime) => {
    setWorktimeSelectionOpen(false);
    // Auto-add the worktime with default quantity
    addWorktimeToOrderWithDefaults(worktime);
  };

  async function addWorktimeToOrderWithDefaults(worktime) {
    try {
      await axios.post(`${getApiBaseUrl()}/orders/${selectedOrder.id}/worktimes`, {
        worktime_id: worktime.id,
        quantity: worktimeForm.quantity,
        notes: worktimeForm.notes
      });
      loadOrderWorktimes(selectedOrder.id);
      setWorktimeForm({ worktime_id: "", quantity: 1, notes: "" });
      setWorktimeSelectionOpen(false);
    } catch (error) {
      alert('Грешка при добавяне на нормовреме');
    }
  }

  async function createNewWorktime() {
    if (!newWorktimeForm.title.trim() || !newWorktimeForm.hours || !newWorktimeForm.component_type) {
      alert('Моля попълнете всички полета: Наименование, Часове и Компонент');
      return;
    }

    try {
      const response = await axios.post(`${getApiBaseUrl()}/worktimes`, newWorktimeForm);
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
        component_type: worktimeCategoryKey || getCategoriesForVehicleType(orderVehicleType)[0]?.key || 'regular'
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
                      <Typography variant="h5" sx={{ fontWeight: 900 }}>{totalWorktimesHours.toFixed(2).replace(/\.00$/, '')}ч</Typography>
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

          <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 1.25 }}>
            <Typography variant={isMobile ? 'subtitle1' : 'h6'} sx={{ fontWeight: 900 }}>
              Добавени нормовремена
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
              ({displayedOrderWorktimes.length})
            </Typography>
          </Stack>
          {displayedOrderWorktimes.length > 0 ? (
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
          )}
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
          onClick={() => setWorktimeSelectionOpen(true)}
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
          <AddIcon sx={{ fontSize: '1.5rem' }} />
          Избери нормовреме за добавяне
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box
            sx={{
              borderBottom: (theme) => `2px solid ${theme.palette.mode === 'dark' ? '#555' : '#ccc'}`,
              backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#2a2a2a' : '#f8f8f8',
              p: 2,
            }}
          >
            <Typography sx={{ fontWeight: 800, mb: 1 }}>
              Категория ({orderVehicleType === 'trailer' ? 'Ремарке' : 'Автомобил'})
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: orderVehicleType === 'trailer' ? 'repeat(5, 1fr)' : 'repeat(3, 1fr)',
                },
                gap: 1,
              }}
            >
              {selectionCategories.map((cat) => {
                const count = availableWorktimes.filter(
                  (w) => getWorktimeCategoryKey(w, orderVehicleType) === cat.key
                ).length;
                const selected = worktimeCategoryKey === cat.key;
                return (
                  <Button
                    key={cat.key}
                    variant={selected ? 'contained' : 'outlined'}
                    onClick={() => setWorktimeCategoryKey(cat.key)}
                    sx={{
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      py: 1,
                      px: 1.25,
                      borderRadius: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.25 }}>
                      <Typography sx={{ fontWeight: 900 }}>{cat.no}</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.1 }}>
                        {cat.label}
                      </Typography>
                    </Box>
                    <Chip
                      label={count}
                      size="small"
                      color={selected ? 'default' : 'primary'}
                      variant={selected ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 900 }}
                    />
                  </Button>
                );
              })}
            </Box>
          </Box>
          <Box sx={{ p: 3 }}>
            {/* Mobile Tab Indicator */}
            <Box sx={{ display: { xs: 'block', sm: 'none' }, mb: 2 }}>
              <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                📋 {formatCategoryLabel(orderVehicleType, worktimeCategoryKey)}
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
              Изберете нормовреме от списъка по-долу. То ще бъде автоматично добавено към поръчката.
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
              {availableWorktimes
                .filter(w =>
                  getWorktimeCategoryKey(w, orderVehicleType) === worktimeCategoryKey &&
                  (worktimeSearch === '' ||
                   w.title.toLowerCase().includes(worktimeSearch.toLowerCase()) ||
                   String(w.component_type || '').toLowerCase().includes(worktimeSearch.toLowerCase()))
                )
                .map((worktime, index) => (
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
                    {index <
                      availableWorktimes.filter(
                        (w) => getWorktimeCategoryKey(w, orderVehicleType) === worktimeCategoryKey
                      ).length -
                        1 && (
                      <Divider sx={{
                        borderColor: (theme) => theme.palette.mode === 'dark' ? '#555' : '#ddd',
                        my: 1
                      }} />
                    )}
                  </div>
                ))}
              {availableWorktimes.filter(
                (w) => getWorktimeCategoryKey(w, orderVehicleType) === worktimeCategoryKey
              ).length === 0 && (
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
                        📭 Няма нормовремена за тази категория
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
                  onChange={(e) => setNewWorktimeForm({ ...newWorktimeForm, component_type: e.target.value })}
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
