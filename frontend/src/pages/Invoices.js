import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
  import {
    Container,
    Typography,
    TextField,
    Tooltip,
    Box,
    Card,
    CardActionArea,
    CardActions,
    List,
    ListItem,
    ListItemText,
    Divider,
    Chip,
    InputAdornment,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Paper,
    MenuItem,
    FormControl,
    InputLabel,
    Select,
    Checkbox,
    FormControlLabel,
    Switch,
    useMediaQuery,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
  } from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AssignmentIcon from '@mui/icons-material/Assignment';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PaidIcon from '@mui/icons-material/Paid';
import LinkIcon from '@mui/icons-material/Link';

import { getApiBaseUrl } from '../api';
import { decodeJwtPayload } from '../utils/jwt';
import {
  formatCategoryLabel,
  getCategoriesForVehicleType,
  getWorktimeCategoryKey,
} from '../utils/worktimeClassification';
import { ciIncludes, normCi } from '../utils/ciSearch';

export default function Invoices({ canDeleteInvoices = false }) {
  const fullScreenDialog = useMediaQuery('(max-width:600px)');
  const isPhone = fullScreenDialog;

  const isAdmin = useMemo(() => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      const payload = decodeJwtPayload(token);
      return payload?.role === 'admin';
    } catch {
      return false;
    }
  }, []);
  const [company, setCompany] = useState({
    company_name: '',
    eik: '',
    vat_number: '',
    city: '',
    address: '',
    mol: '',
    bank_name: '',
    bic: '',
    iban: '',
    logo_data_url: '',
    invoice_prefix: '09',
    invoice_pad_length: 8,
    invoice_offset: 0,
    protocol_pad_length: 10,
    protocol_offset: 0,
    payment_method: 'Банков път',
    hourly_rate: 100,
    vat_rate: 20,
    eur_rate: 1.95583,
    price_multiplier_out_of_hours: 1,
    price_multiplier_holiday: 1,
    price_multiplier_out_of_service: 1,
  });

  const [preparedBy, setPreparedBy] = useState('');
  const [recipient, setRecipient] = useState({
    name: '',
    eik: '',
    vat_number: '',
    city: '',
    address: '',
    mol: '',
  });
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');

  // Month filter for completed orders (YYYY-MM) or 'all'
  const [monthKey, setMonthKey] = useState('all');

  // current (last 3 months + all uninvoiced) vs archive (invoiced and older than 3 months)
  const [viewMode, setViewMode] = useState('current'); // 'current' | 'archive' | 'all'

  const [sortMode, setSortMode] = useState('dateDesc');

  // order_id -> order_documents row (includes created_at)
  const [invoicedDocsByOrderId, setInvoicedDocsByOrderId] = useState({});

  const [markPaidConfirmOpen, setMarkPaidConfirmOpen] = useState(false);
  const [markPaidOrder, setMarkPaidOrder] = useState(null);
  const [markingPaid, setMarkingPaid] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [complaintDraft, setComplaintDraft] = useState('');

  const [selectedVehicleType, setSelectedVehicleType] = useState(null); // 'truck' | 'trailer' | null
  const [vehicleTypeOverride, setVehicleTypeOverride] = useState(null); // 'truck' | 'trailer' | null

  const [orderWorktimes, setOrderWorktimes] = useState([]);
  const [availableWorktimes, setAvailableWorktimes] = useState([]);
  const [addWorktimeDialogOpen, setAddWorktimeDialogOpen] = useState(false);
  const [worktimeSearch, setWorktimeSearch] = useState('');
  const [addWorktimeQuantity, setAddWorktimeQuantity] = useState(1);
  const [worktimeCategoryKey, setWorktimeCategoryKey] = useState('regular');
  const [worktimeDetailsOpen, setWorktimeDetailsOpen] = useState(false);
  const [selectedOrderWorktime, setSelectedOrderWorktime] = useState(null);
  const [quantityDraft, setQuantityDraft] = useState(1);
  const [priceDraft, setPriceDraft] = useState(0);
  const [savingPrice, setSavingPrice] = useState(false);

  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const [invoiceConfirmOpen, setInvoiceConfirmOpen] = useState(false);
  const [reservingDocs, setReservingDocs] = useState(false);

  // Date printed on invoice/protocol (YYYY-MM-DD). Can be edited before invoicing.
  const [invoiceIssueDateDraft, setInvoiceIssueDateDraft] = useState('');

  // Multipliers (selected before invoicing)
  const [multOutOfHoursChecked, setMultOutOfHoursChecked] = useState(false);
  const [multHolidayChecked, setMultHolidayChecked] = useState(false);
  const [multOutOfServiceChecked, setMultOutOfServiceChecked] = useState(false);

  // Optional: send invoice by email on invoicing
  const [sendInvoiceByEmail, setSendInvoiceByEmail] = useState(false);
  const [invoiceEmailTo, setInvoiceEmailTo] = useState('');
  const [sendingInvoiceEmail, setSendingInvoiceEmail] = useState(false);
  const [emailTooltipOpen, setEmailTooltipOpen] = useState(false);

  // Bulk/group invoicing
  const [bulkEnabled, setBulkEnabled] = useState(false);
  const [bulkClientKey, setBulkClientKey] = useState('');
  const [bulkSelectedOrderIds, setBulkSelectedOrderIds] = useState([]);
  const [bulkPreviewOpen, setBulkPreviewOpen] = useState(false);
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [bulkWorktimesByOrderId, setBulkWorktimesByOrderId] = useState({});
  const [bulkMissingFreeOps, setBulkMissingFreeOps] = useState([]);
  // Bulk: draft unit prices for missing free ops (keyed by order_worktime_id)
  const [bulkFreeOpsPriceDraftByRowId, setBulkFreeOpsPriceDraftByRowId] = useState({});
  const [bulkFreeOpsSavingRowId, setBulkFreeOpsSavingRowId] = useState(null);
  const [bulkRecipientDraft, setBulkRecipientDraft] = useState({
    name: '',
    eik: '',
    vat_number: '',
    city: '',
    address: '',
    mol: '',
  });
  const [bulkIssueDateDraft, setBulkIssueDateDraft] = useState(new Date().toISOString().slice(0, 10));
  const [bulkMultOutOfHoursChecked, setBulkMultOutOfHoursChecked] = useState(false);
  const [bulkMultHolidayChecked, setBulkMultHolidayChecked] = useState(false);
  const [bulkMultOutOfServiceChecked, setBulkMultOutOfServiceChecked] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);

  // Group-invoice focus (filter orders by a shared invoice_no)
  const [groupFocusInvoiceNo, setGroupFocusInvoiceNo] = useState('');
  const [groupPreviewLoading, setGroupPreviewLoading] = useState(false);

  // Avoid re-rendering the entire Invoices page on every keystroke while typing in the email field.
  // We keep the latest value in a ref, and only sync to state with a small debounce.
  const invoiceEmailInputRef = useRef('');
  const invoiceEmailChangeTimerRef = useRef(null);
  const setInvoiceEmailDebounced = (val) => {
    invoiceEmailInputRef.current = val;
    if (invoiceEmailChangeTimerRef.current) {
      clearTimeout(invoiceEmailChangeTimerRef.current);
    }
    invoiceEmailChangeTimerRef.current = setTimeout(() => {
      setInvoiceEmailTo(String(invoiceEmailInputRef.current || ''));
    }, 200);
  };

  useEffect(() => {
    // Show the "enter email" tooltip only briefly (4 seconds) when it's relevant.
    if (!sendInvoiceByEmail || String(invoiceEmailTo || '').trim()) {
      setEmailTooltipOpen(false);
      return;
    }

    setEmailTooltipOpen(true);
    const t = setTimeout(() => setEmailTooltipOpen(false), 4000);
    return () => clearTimeout(t);
  }, [sendInvoiceByEmail, invoiceEmailTo]);

  const getPreparedByFromJwt = () => {
    const token = localStorage.getItem('token');
    if (!token) return '';
    try {
      const payload = decodeJwtPayload(token);
      if (!payload) throw new Error('Invalid token');
      return (
        payload.full_name ||
        [payload.first_name, payload.last_name].filter(Boolean).join(' ').trim() ||
        payload.nickname ||
        ''
      );
    } catch {
      return '';
    }
  };

  async function loadCompletedOrders() {
    const res = await axios.get(`${getApiBaseUrl()}/orders/completed`);
    setOrders(res.data);
  }

  async function loadOrderDocuments() {
    try {
      const res = await axios.get(`${getApiBaseUrl()}/orders/documents`);
      const rows = Array.isArray(res.data) ? res.data : [];
      const map = {};
      rows.forEach((r) => {
        if (r?.order_id != null) map[r.order_id] = r;
      });
      setInvoicedDocsByOrderId(map);
    } catch {
      // ignore
    }
  }

  const openMarkPaidConfirm = (order) => {
    setMarkPaidOrder(order);
    setMarkPaidConfirmOpen(true);
  };

  const confirmMarkPaid = async () => {
    if (!markPaidOrder?.id) return;
    try {
      setMarkingPaid(true);
      const res = await axios.put(`${getApiBaseUrl()}/orders/${markPaidOrder.id}/documents/paid`);
      const updatedDoc = res.data;
      setInvoicedDocsByOrderId((prev) => ({ ...prev, [updatedDoc.order_id]: updatedDoc }));
      setMarkPaidConfirmOpen(false);
      setMarkPaidOrder(null);
    } catch (e) {
      alert('Грешка при отбелязване като платена.');
    } finally {
      setMarkingPaid(false);
    }
  };

  async function loadCompanySettings() {
    try {
      const res = await axios.get(`${getApiBaseUrl()}/preferences/company`);
      setCompany((prev) => ({ ...prev, ...(res.data || {}) }));
    } catch {
      // fallback stays
    }
  }

  async function loadUserInvoicePreparedBy() {
    try {
      const res = await axios.get(`${getApiBaseUrl()}/preferences`);
      const fromPrefs = String(res?.data?.invoice_prepared_by_name || '').trim();
      if (fromPrefs) {
        setPreparedBy(fromPrefs);
        return;
      }
    } catch {
      // ignore and fallback below
    }

    const fromJwt = getPreparedByFromJwt();
    if (fromJwt) setPreparedBy(fromJwt);
  }

  async function loadRecipientForOrder(order) {
    if (!order) return;
    try {
      let client = null;
      if (order.client_id) {
        const res = await axios.get(`${getApiBaseUrl()}/clients/${order.client_id}`);
        client = res.data;
      } else if (order.client_name) {
        const res = await axios.get(
          `${getApiBaseUrl()}/clients/search?q=${encodeURIComponent(order.client_name)}`
        );
        const list = Array.isArray(res.data) ? res.data : [];
        client = list.find((c) => c.name === order.client_name) || list[0] || null;
      }

      setRecipient({
        name: client?.name || order.client_name || '',
        eik: client?.eik || '',
        vat_number: client?.vat_number || '',
        city: client?.city || '',
        address: client?.address || '',
        mol: client?.mol || '',
      });

      return client;
    } catch {
      setRecipient({
        name: order.client_name || '',
        eik: '',
        vat_number: '',
        city: '',
        address: '',
        mol: '',
      });

      return null;
    }
  }

  async function loadOrderWorktimes(orderId) {
    try {
      const res = await axios.get(`${getApiBaseUrl()}/orders/${orderId}/worktimes`);
      setOrderWorktimes(res.data);
    } catch {
      setOrderWorktimes([]);
    }
  }

  async function loadAvailableWorktimes() {
    try {
      // Load standard worktimes (permission-gated) + free operations (available for ALL authenticated users).
      const vt = categoryVehicleType || 'truck';

      const stdPromise = axios.get(`${getApiBaseUrl()}/worktimes?vehicle_type=${encodeURIComponent(vt)}`);
      const freePromise = axios.get(`${getApiBaseUrl()}/worktimes/free_ops?vehicle_type=${encodeURIComponent(vt)}`);

      const [stdRes, freeRes] = await Promise.allSettled([stdPromise, freePromise]);

      const std = stdRes.status === 'fulfilled' ? (Array.isArray(stdRes.value.data) ? stdRes.value.data : []) : [];
      const free = freeRes.status === 'fulfilled' ? (Array.isArray(freeRes.value.data) ? freeRes.value.data : []) : [];

      // Merge, de-duplicate by id (free ops are stored in the same table).
      const byId = new Map();
      [...std, ...free].forEach((w) => {
        if (!w?.id) return;
        byId.set(w.id, w);
      });

      setAvailableWorktimes(Array.from(byId.values()));
    } catch {
      setAvailableWorktimes([]);
    }
  }

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

  // This effect is intended to run only once on mount.
  useEffect(() => {
    loadCompletedOrders();
    loadCompanySettings();
    loadOrderDocuments();

    // Initial: JWT name, then override from per-account preferences (if set)
    const fromJwt = getPreparedByFromJwt();
    if (fromJwt) setPreparedBy(fromJwt);
    loadUserInvoicePreparedBy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parseOrderDate = (o) => {
    const dt = o?.completed_at || o?.created_at;
    if (!dt) return null;
    // SQLite datetime('now') returns 'YYYY-MM-DD HH:MM:SS'
    const safe = String(dt).replace(' ', 'T');
    const d = new Date(safe);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const archiveCutoff = useMemo(() => {
    const d = new Date();
    // Inclusive cutoff: everything invoiced with a completion date up to (today - 3 months) goes to Archive.
    // We set the cutoff to end-of-day so the whole cutoff date is included.
    d.setHours(23, 59, 59, 999);
    d.setMonth(d.getMonth() - 3);
    return d;
  }, []);

  const baseOrders = useMemo(() => {
    const isInvoicedLocal = (o) => Boolean(invoicedDocsByOrderId?.[o?.id]);
    const isPaidLocal = (o) => Number(invoicedDocsByOrderId?.[o?.id]?.is_paid) === 1;
    const isArchivedLocal = (o) => {
      const d = parseOrderDate(o);
      if (!d) return false;
      // Archive rules:
      // - PAID invoices are always archived
      // - Additionally keep the old rule: invoiced + older than 3 months -> archive
      return isPaidLocal(o) || (isInvoicedLocal(o) && d.getTime() <= archiveCutoff.getTime());
    };

    if (viewMode === 'all') {
      return orders;
    }

    if (viewMode === 'archive') {
      return orders.filter((o) => isArchivedLocal(o));
    }
    // Current: everything except "archived" (so old but NOT invoiced stays visible and red)
    return orders.filter((o) => !isArchivedLocal(o));
  }, [orders, viewMode, invoicedDocsByOrderId, archiveCutoff]);

  const invoiceGroupMetaByInvoiceNo = useMemo(() => {
    const docs = Object.values(invoicedDocsByOrderId || {});
    const map = new Map();
    docs.forEach((d) => {
      const inv = String(d?.invoice_no || '').trim();
      if (!inv) return;
      const prev = map.get(inv) || { invoice_no: inv, count: 0, order_ids: [] };
      prev.count += 1;
      if (d?.order_id != null) prev.order_ids.push(Number(d.order_id));
      map.set(inv, prev);
    });
    // Normalize order_ids
    map.forEach((v) => {
      v.order_ids = Array.from(new Set((v.order_ids || []).filter((x) => Number.isFinite(x)))).sort((a, b) => a - b);
    });
    return map;
  }, [invoicedDocsByOrderId]);

  const monthTabs = useMemo(() => {
    const isInvoicedLocal = (o) => Boolean(invoicedDocsByOrderId?.[o?.id]);
    const map = new Map();

    baseOrders.forEach((o) => {
      const d = parseOrderDate(o);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
      const prev = map.get(key) || { total: 0, invoiced: 0, notInvoiced: 0 };
      prev.total += 1;
      if (isInvoicedLocal(o)) prev.invoiced += 1;
      else prev.notInvoiced += 1;
      map.set(key, prev);
    });

    const keys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a)); // newest first

    const allCounts = baseOrders.reduce(
      (acc, o) => {
        acc.total += 1;
        if (isInvoicedLocal(o)) acc.invoiced += 1;
        else acc.notInvoiced += 1;
        return acc;
      },
      { total: 0, invoiced: 0, notInvoiced: 0 }
    );

    const items = [
      {
        key: 'all',
        label: 'Всички',
        ...allCounts,
      },
    ];

    keys.forEach((k) => {
      const [y, m] = k.split('-');
      const counts = map.get(k);
      items.push({
        key: k,
        label: `${m}.${y}`,
        total: counts.total,
        invoiced: counts.invoiced,
        notInvoiced: counts.notInvoiced,
      });
    });

    return items;
  }, [baseOrders, invoicedDocsByOrderId]);

  const filteredOrders = useMemo(() => {
    const q = normCi(search).trim();
    const monthFiltered =
      monthKey === 'all'
        ? baseOrders
        : baseOrders.filter((o) => {
            const d = parseOrderDate(o);
            if (!d) return false;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            return key === monthKey;
          });

    const searched = !q
      ? monthFiltered
      : monthFiltered.filter((o) =>
          ciIncludes(`${o.reg_number} ${o.client_name} ${o.complaint}`, q)
        );

    const getTs = (o) => {
      const d = parseOrderDate(o);
      return d ? d.getTime() : Number.POSITIVE_INFINITY;
    };
    const isInv = (o) => Boolean(invoicedDocsByOrderId?.[o?.id]);

    const sorted = [...searched].sort((a, b) => {
      const aTs = getTs(a);
      const bTs = getTs(b);
      const aInv = isInv(a);
      const bInv = isInv(b);

      switch (sortMode) {
        case 'dateAsc':
          return aTs - bTs;
        case 'dateDesc':
          return bTs - aTs;
        case 'invoicedFirst': {
          if (aInv !== bInv) return aInv ? -1 : 1;
          return bTs - aTs;
        }
        case 'notInvoicedFirst': {
          if (aInv !== bInv) return aInv ? 1 : -1;
          return bTs - aTs;
        }
        default:
          return bTs - aTs;
      }
    });

    // Optional: focus on a single group invoice (shared invoice_no)
    const focusInv = String(groupFocusInvoiceNo || '').trim();
    if (focusInv) {
      return sorted.filter((o) => String(invoicedDocsByOrderId?.[o?.id]?.invoice_no || '').trim() === focusInv);
    }

    return sorted;
  }, [baseOrders, search, monthKey, sortMode, invoicedDocsByOrderId, groupFocusInvoiceNo]);

  const getClientKeyForOrder = (o) => {
    if (o?.client_id != null && String(o.client_id).trim() !== '') return `id:${o.client_id}`;
    const name = String(o?.client_name || '').trim();
    return name ? `name:${name}` : 'unknown';
  };

  const bulkEligibleOrders = useMemo(() => {
    // Bulk invoicing is relevant mostly for NOT invoiced completed orders.
    const isInv = (o) => Boolean(invoicedDocsByOrderId?.[o?.id]);
    const monthFiltered =
      monthKey === 'all'
        ? baseOrders
        : baseOrders.filter((o) => {
            const d = parseOrderDate(o);
            if (!d) return false;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            return key === monthKey;
          });
    return monthFiltered.filter((o) => !isInv(o) && getClientKeyForOrder(o) !== 'unknown');
  }, [baseOrders, monthKey, invoicedDocsByOrderId]);

  const bulkClientOptions = useMemo(() => {
    const map = new Map();
    bulkEligibleOrders.forEach((o) => {
      const key = getClientKeyForOrder(o);
      if (key === 'unknown') return;
      const prev = map.get(key) || {
        key,
        client_name: String(o?.client_name || '').trim(),
        client_id: o?.client_id ?? null,
        count: 0,
        total_amount_bgn: 0,
      };
      prev.count += 1;
      prev.total_amount_bgn += Number(o?.total_amount_bgn) || 0;
      // Keep the latest non-empty client_name
      if (!prev.client_name) prev.client_name = String(o?.client_name || '').trim();
      map.set(key, prev);
    });

    return Array.from(map.values()).sort((a, b) => {
      // More orders first, then name
      if (b.count !== a.count) return b.count - a.count;
      return String(a.client_name || '').localeCompare(String(b.client_name || ''), 'bg');
    });
  }, [bulkEligibleOrders]);

  const bulkOrdersForSelectedClient = useMemo(() => {
    if (!bulkClientKey) return [];
    return bulkEligibleOrders.filter((o) => getClientKeyForOrder(o) === bulkClientKey);
  }, [bulkEligibleOrders, bulkClientKey]);

  const bulkSelectedOrders = useMemo(() => {
    const set = new Set((bulkSelectedOrderIds || []).map((x) => Number(x)));
    return bulkOrdersForSelectedClient.filter((o) => set.has(Number(o?.id)));
  }, [bulkOrdersForSelectedClient, bulkSelectedOrderIds]);

  // Simple financial/order stats (completed orders list)
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfLast7Days = new Date(now);
  startOfLast7Days.setDate(now.getDate() - 7);

  const totalCompleted = baseOrders.length;
  const shownCompleted = filteredOrders.length;
  const uniqueClientsCount = new Set(baseOrders.map((o) => String(o?.client_name || '').trim()).filter(Boolean)).size;

  const invoicedForCompleted = baseOrders.filter((o) => Boolean(invoicedDocsByOrderId?.[o?.id])).length;
  const notInvoicedForCompleted = Math.max(0, totalCompleted - invoicedForCompleted);
  const paidForCompleted = baseOrders.filter((o) => Number(invoicedDocsByOrderId?.[o?.id]?.is_paid) === 1).length;

  const invoicingAmounts = useMemo(() => {
    const eurRate = Number(company.eur_rate) || 1.95583;
    const sumBgn = (arr) =>
      arr.reduce((acc, o) => acc + (Number(o?.total_amount_bgn) || 0), 0);
    const isInv = (o) => Boolean(invoicedDocsByOrderId?.[o?.id]);
    const isPaid = (o) => Number(invoicedDocsByOrderId?.[o?.id]?.is_paid) === 1;

    const paidOrders = filteredOrders.filter((o) => isInv(o) && isPaid(o));
    const invoicedUnpaidOrders = filteredOrders.filter((o) => isInv(o) && !isPaid(o));
    const notInvoicedOrders = filteredOrders.filter((o) => !isInv(o));

    const totalCount = filteredOrders.length;
    const invoicedCount = paidOrders.length + invoicedUnpaidOrders.length;
    const paidCount = paidOrders.length;

    const paidBgn = sumBgn(paidOrders);
    const invoicedUnpaidBgn = sumBgn(invoicedUnpaidOrders);
    const notInvoicedBgn = sumBgn(notInvoicedOrders);
    const totalBgn = paidBgn + invoicedUnpaidBgn + notInvoicedBgn;

    const pctPaid = totalBgn > 0 ? (paidBgn / totalBgn) * 100 : 0;
    const pctInvoicedUnpaid = totalBgn > 0 ? (invoicedUnpaidBgn / totalBgn) * 100 : 0;
    const pctNotInvoiced = totalBgn > 0 ? (notInvoicedBgn / totalBgn) * 100 : 0;

    return {
      eurRate,
      paidBgn,
      invoicedUnpaidBgn,
      notInvoicedBgn,
      totalBgn,
      totalCount,
      invoicedCount,
      paidCount,
      pctPaid,
      pctInvoicedUnpaid,
      pctNotInvoiced,
    };
  }, [filteredOrders, invoicedDocsByOrderId, company.eur_rate]);

  const getOrderDate = (o) => parseOrderDate(o);

  const completedTodayCount = baseOrders.filter((o) => {
    const d = getOrderDate(o);
    return d ? d >= startOfToday : false;
  }).length;

  const completedLast7DaysCount = baseOrders.filter((o) => {
    const d = getOrderDate(o);
    return d ? d >= startOfLast7Days : false;
  }).length;

  const openOrder = async (order) => {
    setSelectedOrder(order);
    setSelectedVehicleType(null);
    setVehicleTypeOverride(null);
    setComplaintDraft(order.complaint || '');
    setSendInvoiceByEmail(false);
    setInvoiceEmailTo('');
    invoiceEmailInputRef.current = '';
    setOrderDialogOpen(true);

    // Default invoice issue date to the service date (completed_at || created_at) to preserve old behavior.
    // If already invoiced, show the stored issue_date (read-only in UI).
    const existingDoc = invoicedDocsByOrderId?.[order?.id];
    const serviceDate = String(order?.completed_at || order?.created_at || '').slice(0, 10);
    const storedIssueDate = String(existingDoc?.issue_date || '').slice(0, 10);
    setInvoiceIssueDateDraft(storedIssueDate || serviceDate || new Date().toISOString().slice(0, 10));

    // If the order is already invoiced, keep the previously applied multipliers (locked).
    // Otherwise default to unchecked.
    setMultOutOfHoursChecked(Number(existingDoc?.mult_out_of_hours) > 1);
    setMultHolidayChecked(Number(existingDoc?.mult_holiday) > 1);
    setMultOutOfServiceChecked(Number(existingDoc?.mult_out_of_service) > 1);

    await loadOrderWorktimes(order.id);
    const client = await loadRecipientForOrder(order);
    const prefillEmail = String(client?.email || '').trim();
    invoiceEmailInputRef.current = prefillEmail;
    setInvoiceEmailTo(prefillEmail);
    const vt = await loadVehicleTypeForReg(order.reg_number);
    setSelectedVehicleType(vt);
    const firstKey = getCategoriesForVehicleType(vt || 'truck')[0]?.key || 'regular';
    setWorktimeCategoryKey(firstKey);
  };

  const categoryVehicleType = (vehicleTypeOverride || selectedVehicleType || 'truck') === 'trailer'
    ? 'trailer'
    : 'truck';

  useEffect(() => {
    // Keep selected category valid when vehicle type changes.
    const keys = new Set(getCategoriesForVehicleType(categoryVehicleType).map((c) => c.key));
    if (!keys.has(worktimeCategoryKey)) {
      const firstKey = getCategoriesForVehicleType(categoryVehicleType)[0]?.key || 'regular';
      setWorktimeCategoryKey(firstKey);
    }
  }, [categoryVehicleType, worktimeCategoryKey]);

  const openAddWorktimeDialog = async () => {
    setAddWorktimeDialogOpen(true);
    await loadAvailableWorktimes();
  };

  const addWorktimeToOrder = async (worktime) => {
    if (!selectedOrder || !worktime) return;
    try {
      await axios.post(`${getApiBaseUrl()}/orders/${selectedOrder.id}/worktimes`, {
        worktime_id: worktime.id,
        quantity: addWorktimeQuantity,
        notes: '',
      });
      setAddWorktimeDialogOpen(false);
      setWorktimeSearch('');
      setAddWorktimeQuantity(1);
      await loadOrderWorktimes(selectedOrder.id);
    } catch {
      alert('Грешка при добавяне на нормовреме');
    }
  };

  const removeOrderWorktime = async (orderWorktimeId) => {
    if (!selectedOrder || !orderWorktimeId) return;
    if (!window.confirm('Сигурни ли сте, че искате да премахнете това нормовреме?')) return;
    try {
      await axios.delete(`${getApiBaseUrl()}/orders/worktimes/${orderWorktimeId}`);
      await loadOrderWorktimes(selectedOrder.id);
      setWorktimeDetailsOpen(false);
    } catch {
      alert('Грешка при премахване на нормовреме');
    }
  };

  const saveOrderEdits = async () => {
    if (!selectedOrder) return;
    try {
      setSavingOrder(true);
      const res = await axios.put(`${getApiBaseUrl()}/orders/${selectedOrder.id}`, {
        complaint: complaintDraft,
      });
      const updated = res.data;
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (e) {
      alert('Грешка при запис на корекции по поръчката');
    } finally {
      setSavingOrder(false);
    }
  };

  const openWorktimeDetails = (ow) => {
    setSelectedOrderWorktime(ow);
    setQuantityDraft(ow?.quantity || 1);
    setPriceDraft(Number(ow?.unit_price_bgn) || 0);
    setWorktimeDetailsOpen(true);
  };

  const formatSqliteDateTime = (dt) => {
    if (!dt) return '—';
    // SQLite datetime('now') returns 'YYYY-MM-DD HH:MM:SS'
    const safe = String(dt).replace(' ', 'T');
    const d = new Date(safe);
    return Number.isNaN(d.getTime()) ? String(dt) : d.toLocaleString('bg-BG');
  };

  // Used in invoice/protocol document print: issue dates must NOT include time.
  const formatSqliteDateOnly = (dt) => {
    if (!dt) return '—';

    const s = String(dt);
    // Support both:
    // - SQLite datetime('now') => 'YYYY-MM-DD HH:MM:SS'
    // - Date-only => 'YYYY-MM-DD'
    const dateOnlyMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      return `${dateOnlyMatch[3]}.${dateOnlyMatch[2]}.${dateOnlyMatch[1]}`;
    }

    // SQLite datetime('now') returns 'YYYY-MM-DD HH:MM:SS'
    const safe = s.replace(' ', 'T');
    const d = new Date(safe);
    return Number.isNaN(d.getTime()) ? s.slice(0, 10) : d.toLocaleDateString('bg-BG');
  };

  const formatBgnEur = (bgnAmount) => {
    const bgn = Number(bgnAmount) || 0;
    const eurRate = Number(company.eur_rate) || 1.95583;
    const eur = bgn / eurRate;
    return `${bgn.toFixed(2)} лв / ${eur.toFixed(2)} EUR`;
  };

  const getBgnEurParts = (bgnAmount) => {
    const bgn = Number(bgnAmount) || 0;
    const eurRate = Number(company.eur_rate) || 1.95583;
    const eur = bgn / eurRate;
    return {
      bgn: `${bgn.toFixed(2)} лв`,
      eur: `${eur.toFixed(2)} EUR`,
    };
  };

  const getInvoiceStatusMeta = (order) => {
    const doc = invoicedDocsByOrderId?.[order?.id];
    const invoiced = Boolean(doc);
    const paid = Number(doc?.is_paid) === 1;
    if (!invoiced) {
      return {
        key: 'notInvoiced',
        label: 'НЕФАКТУРИРАНА',
        color: 'error',
        borderColor: (theme) => theme.palette.error.main,
        bg: (theme) => theme.palette.error.main + '10',
      };
    }
    if (paid) {
      return {
        key: 'paid',
        label: 'ПЛАТЕНА',
        color: 'warning',
        borderColor: (theme) => theme.palette.warning.main,
        bg: (theme) => theme.palette.warning.main + '10',
      };
    }
    return {
      key: 'invoiced',
      label: 'ФАКТУРИРАНА',
      color: 'success',
      borderColor: (theme) => theme.palette.success.main,
      bg: (theme) => theme.palette.success.main + '10',
    };
  };

  const WRAP_CHIP_SX = {
    minWidth: 0,
    maxWidth: '100%',
    height: 'auto',
    alignItems: 'flex-start',
    '& .MuiChip-label': {
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
      lineHeight: 1.2,
      display: 'block',
      paddingTop: '3px',
      paddingBottom: '3px',
    },
  };

  const escapeHtml = (unsafe) => {
    return String(unsafe ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  };

  const numberToBgWords = (n) => {
    const ones = ['нула', 'един', 'две', 'три', 'четири', 'пет', 'шест', 'седем', 'осем', 'девет'];
    const teens = [
      'десет',
      'единадесет',
      'дванадесет',
      'тринадесет',
      'четиринадесет',
      'петнадесет',
      'шестнадесет',
      'седемнадесет',
      'осемнадесет',
      'деветнадесет',
    ];
    const tens = ['', '', 'двадесет', 'тридесет', 'четиридесет', 'петдесет', 'шестдесет', 'седемдесет', 'осемдесет', 'деветдесет'];
    const hundreds = ['', 'сто', 'двеста', 'триста', 'четиристотин', 'петстотин', 'шестстотин', 'седемстотин', 'осемстотин', 'деветстотин'];

    const toUnder100 = (x) => {
      if (x < 10) return ones[x];
      if (x < 20) return teens[x - 10];
      const t = Math.floor(x / 10);
      const o = x % 10;
      return o ? `${tens[t]} и ${ones[o]}` : tens[t];
    };

    const toUnder1000 = (x) => {
      if (x < 100) return toUnder100(x);
      const h = Math.floor(x / 100);
      const r = x % 100;
      if (!r) return hundreds[h];
      return `${hundreds[h]} ${r < 20 ? 'и ' : ''}${toUnder100(r)}`.replace('  ', ' ').trim();
    };

    const x = Math.floor(Math.abs(Number(n) || 0));
    if (x < 1000) return toUnder1000(x);
    if (x < 1000000) {
      const th = Math.floor(x / 1000);
      const r = x % 1000;
      const thWord = th === 1 ? 'хиляда' : `${toUnder1000(th)} хиляди`;
      if (!r) return thWord;
      return `${thWord} ${r < 100 ? 'и ' : ''}${toUnder1000(r)}`.replace('  ', ' ').trim();
    }
    return x.toString();
  };

  const reserveDocumentNumbers = async () => {
    if (!selectedOrder) throw new Error('No order selected');
    const res = await axios.post(`${getApiBaseUrl()}/orders/${selectedOrder.id}/documents/reserve`, {
      issue_date: String(invoiceIssueDateDraft || '').trim() || undefined,
      multipliers: {
        out_of_hours: multOutOfHoursChecked,
        holiday: multHolidayChecked,
        out_of_service: multOutOfServiceChecked,
      },
    });
    return res.data;
  };

  const reserveBulkDocumentNumbers = async ({ orderIds }) => {
    const res = await axios.post(`${getApiBaseUrl()}/orders/documents/reserve-bulk`, {
      order_ids: orderIds,
      issue_date: String(bulkIssueDateDraft || '').trim() || undefined,
      multipliers: {
        out_of_hours: bulkMultOutOfHoursChecked,
        holiday: bulkMultHolidayChecked,
        out_of_service: bulkMultOutOfServiceChecked,
      },
    });
    return res.data;
  };

  const loadWorktimesForManyOrders = async (orderIds) => {
    const ids = Array.isArray(orderIds) ? orderIds : [];
    const pairs = await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await axios.get(`${getApiBaseUrl()}/orders/${id}/worktimes`);
          return [id, Array.isArray(res.data) ? res.data : []];
        } catch {
          return [id, []];
        }
      })
    );
    const map = {};
    pairs.forEach(([id, rows]) => {
      map[id] = rows;
    });
    return map;
  };

  const saveBulkFreeOpsPrice = async ({ orderId, orderWorktimeId }) => {
    const raw = bulkFreeOpsPriceDraftByRowId?.[orderWorktimeId];
    const parsed = Number(String(raw ?? '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      alert('Моля въведете валидна цена (> 0 лв) за „Свободни Операции“.');
      return;
    }

    try {
      setBulkFreeOpsSavingRowId(orderWorktimeId);
      await axios.put(`${getApiBaseUrl()}/orders/${orderId}/worktimes/${orderWorktimeId}`, {
        unit_price_bgn: parsed,
      });

      // Reload worktimes just for this order and recompute missing list.
      const res = await axios.get(`${getApiBaseUrl()}/orders/${orderId}/worktimes`);
      const updatedRows = Array.isArray(res.data) ? res.data : [];

      setBulkWorktimesByOrderId((prev) => ({ ...(prev || {}), [orderId]: updatedRows }));

      // Recompute missing list from the updated map.
      // NOTE: use the latest data for this order (updatedRows) plus previous for all others.
      setBulkMissingFreeOps((prevMissing) => {
        const prev = Array.isArray(prevMissing) ? prevMissing : [];
        // Remove all missing items for this order, then re-add if still missing.
        const kept = prev.filter((x) => Number(x?.order_id) !== Number(orderId));
        const nowMissing = updatedRows
          .filter((r) => String(r?.component_type || '').trim() === 'free_ops')
          .filter((r) => {
            const qty = Number(r?.quantity) || 0;
            const price = Number(r?.unit_price_bgn);
            return qty > 0 && (!Number.isFinite(price) || price <= 0);
          })
          .map((r) => ({
            order_id: orderId,
            order_worktime_id: r?.id,
            title: r?.worktime_title || '',
            quantity: Number(r?.quantity) || 0,
            unit_price_bgn: r?.unit_price_bgn,
          }));

        return [...kept, ...nowMissing];
      });
    } catch (e) {
      alert(e?.response?.data?.error || 'Грешка при запис на цена.');
    } finally {
      setBulkFreeOpsSavingRowId(null);
    }
  };

  const fetchRecipientForBulkClient = async (ordersForClient) => {
    const first = Array.isArray(ordersForClient) ? ordersForClient[0] : null;
    if (!first) return null;

    try {
      if (first.client_id) {
        const res = await axios.get(`${getApiBaseUrl()}/clients/${first.client_id}`);
        const client = res.data;
        return {
          name: client?.name || first.client_name || '',
          eik: client?.eik || '',
          vat_number: client?.vat_number || '',
          city: client?.city || '',
          address: client?.address || '',
          mol: client?.mol || '',
        };
      }

      const name = String(first.client_name || '').trim();
      if (!name) return null;
      const res = await axios.get(`${getApiBaseUrl()}/clients/search?q=${encodeURIComponent(name)}`);
      const list = Array.isArray(res.data) ? res.data : [];
      const client = list.find((c) => c?.name === name) || list[0] || null;
      return {
        name: client?.name || name,
        eik: client?.eik || '',
        vat_number: client?.vat_number || '',
        city: client?.city || '',
        address: client?.address || '',
        mol: client?.mol || '',
      };
    } catch {
      return {
        name: first.client_name || '',
        eik: '',
        vat_number: '',
        city: '',
        address: '',
        mol: '',
      };
    }
  };

  const bulkAppliedMultiplierPreview = useMemo(() => {
    const mOutOfHours = Number(company.price_multiplier_out_of_hours) || 1;
    const mHoliday = Number(company.price_multiplier_holiday) || 1;
    const mOutOfService = Number(company.price_multiplier_out_of_service) || 1;
    return (
      (bulkMultOutOfHoursChecked ? mOutOfHours : 1) *
      (bulkMultHolidayChecked ? mHoliday : 1) *
      (bulkMultOutOfServiceChecked ? mOutOfService : 1)
    );
  }, [
    company.price_multiplier_out_of_hours,
    company.price_multiplier_holiday,
    company.price_multiplier_out_of_service,
    bulkMultOutOfHoursChecked,
    bulkMultHolidayChecked,
    bulkMultOutOfServiceChecked,
  ]);

  const bulkPreviewLines = useMemo(() => {
    const hourlyRate = Number(company.hourly_rate) || 100;
    const vatRate = Number(company.vat_rate) || 20;
    const multiplier = Number(bulkAppliedMultiplierPreview) || 1;

    return bulkSelectedOrders
      .map((o) => {
        const totalHours = Number(o?.total_hours) || 0;
        const freeOps = Number(o?.free_ops_amount_bgn) || 0;
        const taxBase = totalHours * hourlyRate * multiplier + freeOps;
        const vatAmount = taxBase * (vatRate / 100);
        const totalAmount = taxBase + vatAmount;
        return {
          order: o,
          taxBase,
          vatAmount,
          totalAmount,
        };
      })
      .sort((a, b) => Number(b.order?.id) - Number(a.order?.id));
  }, [bulkSelectedOrders, company.hourly_rate, company.vat_rate, bulkAppliedMultiplierPreview]);

  const bulkPreviewTotals = useMemo(() => {
    const taxBase = bulkPreviewLines.reduce((s, x) => s + (Number(x.taxBase) || 0), 0);
    const vatAmount = bulkPreviewLines.reduce((s, x) => s + (Number(x.vatAmount) || 0), 0);
    const totalAmount = bulkPreviewLines.reduce((s, x) => s + (Number(x.totalAmount) || 0), 0);
    return { taxBase, vatAmount, totalAmount };
  }, [bulkPreviewLines]);

  const openBulkInvoicePrint = ({
    docsByOrderId,
    worktimesByOrderId: wtByOrderId,
    previewLines,
    issueDate,
    recipient,
    multiplierOverride,
  }) => {
    // Print: Protocol (original+copy) for each order, then ONE invoice (original+copy) with multiple lines.
    // docsByOrderId: { [orderId]: order_documents row }

    const hourlyRate = Number(company.hourly_rate) || 100;
    const vatRate = Number(company.vat_rate) || 20;
    const eurRate = Number(company.eur_rate) || 1.95583;
    const toEur = (bgn) => (Number(bgn) || 0) / eurRate;
    const fmt2 = (n) => (Number(n) || 0).toFixed(2);
    const fmtBgnEur = (bgn) => `${fmt2(bgn)} лв / ${fmt2(toEur(bgn))} EUR`;
    const fmtBgnEurHtml = (bgn) => {
      const b = Number(bgn) || 0;
      const e = toEur(b);
      return `<div>${fmt2(b)} лв</div><div class="muted" style="font-size:12px;">${fmt2(e)} EUR</div>`;
    };

    const multiplier = Number(multiplierOverride != null ? multiplierOverride : bulkAppliedMultiplierPreview) || 1;
    const effectiveHourlyRate = hourlyRate * multiplier;
    const safeEffectiveHourlyRate = Math.max(0.000001, Number(effectiveHourlyRate) || 0.000001);

    const escapeHtmlLocal = (unsafe) =>
      String(unsafe ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const formatSqliteDateOnlyLocal = (dt) => {
      if (!dt) return '—';
      const s = String(dt);
      const dateOnlyMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dateOnlyMatch) {
        return `${dateOnlyMatch[3]}.${dateOnlyMatch[2]}.${dateOnlyMatch[1]}`;
      }
      const safe = s.replace(' ', 'T');
      const d = new Date(safe);
      return Number.isNaN(d.getTime()) ? s.slice(0, 10) : d.toLocaleDateString('bg-BG');
    };

    const logoDataUrl = company.logo_data_url || '';
    const logoHtml = logoDataUrl
      ? `<img src="${escapeHtmlLocal(logoDataUrl)}" style="max-width:110px; max-height:110px; object-fit:contain;" />`
      : '';

    const WATERMARK_ORIGINAL = 'ОРИГИНАЛ';
    const WATERMARK_COPY = 'КОПИЕ';

    const lines = Array.isArray(previewLines) ? previewLines : bulkPreviewLines;
    const invoiceNo = lines[0]?.order?.id
      ? docsByOrderId?.[lines[0].order.id]?.invoice_no
      : '';
    const resolvedIssueDate = String(issueDate || bulkIssueDateDraft || '').trim() || new Date().toISOString().slice(0, 10);
    const resolvedRecipient = recipient || bulkRecipientDraft;

    const protocolPagesHtml = lines
      .map(({ order }) => {
        const doc = docsByOrderId?.[order.id];
        const protocolNo = doc?.protocol_no || '';

        const rows = Array.isArray(wtByOrderId?.[order.id]) ? wtByOrderId[order.id] : [];
        const laborRows = rows.filter((r) => String(r?.component_type || '').trim() !== 'free_ops');
        const freeRows = rows.filter((r) => String(r?.component_type || '').trim() === 'free_ops');

        const totalHours = laborRows.reduce(
          (sum, r) => sum + (Number(r.hours) || 0) * (Number(r.quantity) || 0),
          0
        );
        const freeOpsNet = freeRows.reduce(
          (sum, r) => sum + (Number(r.unit_price_bgn) || 0) * (Number(r.quantity) || 0),
          0
        );
        const freeOpsHoursEqTotal = freeOpsNet / safeEffectiveHourlyRate;
        const protocolTotalHours = totalHours + freeOpsHoursEqTotal;

        const laborTaxBase = protocolTotalHours * effectiveHourlyRate;
        const taxBase = laborTaxBase;
        const vatAmount = taxBase * (vatRate / 100);
        const totalAmount = taxBase + vatAmount;

        const makeRows = () => {
          if (!rows.length) return '<tr><td colspan="6" class="muted">Няма добавени нормовремена</td></tr>';
          return rows
            .map((r, idx) => {
              const isFree = String(r?.component_type || '').trim() === 'free_ops';
              const qty = Number(r.quantity) || 0;
              const baseHours = Number(r.hours) || 0;
              const unitPrice = Number(r.unit_price_bgn) || 0;
              const hoursPerUnit = isFree ? unitPrice / safeEffectiveHourlyRate : baseHours;
              const total = hoursPerUnit * qty;
              const notes = r.notes ? escapeHtmlLocal(r.notes) : '';
              return `
                <tr>
                  <td style="text-align:center">${idx + 1}</td>
                  <td>${escapeHtmlLocal(r.worktime_title || '')}</td>
                  <td class="notes">${notes}</td>
                  <td style="text-align:right">${hoursPerUnit.toFixed(2).replace(/\.00$/, '')}</td>
                  <td style="text-align:right">${qty}</td>
                  <td style="text-align:right">${total.toFixed(2).replace(/\.00$/, '')}</td>
                </tr>
              `;
            })
            .join('');
        };

        const makeProtocolPage = (watermarkLabel) => `
          <div class="page">
            <div class="watermark"><span>${escapeHtmlLocal(watermarkLabel)}</span></div>
            <div class="content">
              <div class="topbar">
                <div>
                  <h1>Протокол</h1>
                  <div class="meta"><strong>No:</strong> ${escapeHtmlLocal(protocolNo)}</div>
                  <div class="meta"><strong>Към фактура No:</strong> ${escapeHtmlLocal(invoiceNo || '')}</div>
                  <div class="meta"><span class="badge">${escapeHtmlLocal(watermarkLabel)}</span></div>
                </div>
                ${logoHtml}
              </div>

              <div class="grid2">
                <div class="block">
                  <div class="title">Получател:</div>
                   <div class="rowline"><div class="k">Име на фирма:</div><div class="v">${escapeHtmlLocal(resolvedRecipient.name)}</div></div>
                   <div class="rowline"><div class="k">ЕИК:</div><div class="v">${escapeHtmlLocal(resolvedRecipient.eik)}</div></div>
                   <div class="rowline"><div class="k">ДДС No:</div><div class="v">${escapeHtmlLocal(resolvedRecipient.vat_number)}</div></div>
                   <div class="rowline"><div class="k">Град:</div><div class="v">${escapeHtmlLocal(resolvedRecipient.city)}</div></div>
                   <div class="rowline"><div class="k">Адрес:</div><div class="v">${escapeHtmlLocal(resolvedRecipient.address)}</div></div>
                   <div class="rowline"><div class="k">МОЛ:</div><div class="v">${escapeHtmlLocal(resolvedRecipient.mol)}</div></div>
                 </div>
                <div class="block">
                  <div class="title">Доставчик:</div>
                  <div class="rowline"><div class="k">Име на фирма:</div><div class="v">${escapeHtmlLocal(company.company_name)}</div></div>
                  <div class="rowline"><div class="k">ЕИК:</div><div class="v">${escapeHtmlLocal(company.eik)}</div></div>
                  <div class="rowline"><div class="k">ДДС No:</div><div class="v">${escapeHtmlLocal(company.vat_number)}</div></div>
                  <div class="rowline"><div class="k">Град:</div><div class="v">${escapeHtmlLocal(company.city)}</div></div>
                  <div class="rowline"><div class="k">Адрес:</div><div class="v">${escapeHtmlLocal(company.address)}</div></div>
                  <div class="rowline"><div class="k">МОЛ:</div><div class="v">${escapeHtmlLocal(company.mol)}</div></div>
                </div>
              </div>

              <div style="display:flex; justify-content: space-between; gap: 18mm; margin-top: 10mm;">
                <div style="flex:1;" class="summary">
                  <div class="line"><span class="k">Дата на издаване:</span><span class="v">${escapeHtmlLocal(formatSqliteDateOnlyLocal(resolvedIssueDate))}</span></div>
                  <div class="line"><span class="k">Дата на дан. събитие:</span><span class="v">${escapeHtmlLocal(formatSqliteDateOnlyLocal(resolvedIssueDate))}</span></div>
                  <div class="line"><span class="k">Място на сделката:</span><span class="v">${escapeHtmlLocal(company.city || '')}</span></div>
                  <div class="line"><span class="k">Рег. №:</span><span class="v">${escapeHtmlLocal(order.reg_number || '')}</span></div>
                </div>
                <div style="flex:1;" class="summary">
                  <div class="line"><span>Данъчна основа (${vatRate.toFixed(2)} %):</span><span><strong>${fmtBgnEur(taxBase)}</strong></span></div>
                  <div class="line"><span>Начислен ДДС:</span><span><strong>${fmtBgnEur(vatAmount)}</strong></span></div>
                  <div class="line" style="margin-top:6px;"><span><strong>Сума за плащане:</strong></span><span class="big">${fmtBgnEur(totalAmount)}</span></div>
                </div>
              </div>

              <div style="margin-top: 10mm;">
              <table>
                <thead>
                  <tr>
                    <th style="width: 10mm; text-align:center;">No</th>
                    <th>Име на стоката/услугата</th>
                    <th style="width: 55mm;">Бележки</th>
                    <th style="width: 18mm; text-align:right;">Часове</th>
                    <th style="width: 16mm; text-align:right;">К-во</th>
                    <th style="width: 22mm; text-align:right;">Общо (ч.)</th>
                  </tr>
                </thead>
                <tbody>
                  ${makeRows()}
                </tbody>
              </table>

              <div style="display:flex; justify-content: space-between; gap: 18mm; margin-top: 10mm;">
                <div style="flex:1;" class="summary">
                  <div class="line"><span>Начин на плащане:</span><span><strong>${escapeHtmlLocal(company.payment_method || 'Банков път')}</strong></span></div>
                  <div class="line"><span>Банкови реквизити:</span><span></span></div>
                  <div class="line"><span></span><span><strong>${escapeHtmlLocal(company.bank_name)}${company.bic ? `, BIC: ${escapeHtmlLocal(company.bic)}` : ''}</strong></span></div>
                  <div class="line"><span></span><span><strong>${escapeHtmlLocal(company.iban)}</strong></span></div>
                </div>
                 <div style="flex:1;" class="summary">
                   <div class="line"><span><strong>Труд (часове):</strong></span><span><strong>${protocolTotalHours.toFixed(2).replace(/\.00$/, '')} ч.</strong></span></div>
                   <div class="line"><span><strong>Цена на час:</strong></span><span><strong>${fmtBgnEur(effectiveHourlyRate)}</strong></span></div>
                   <div class="line"><span><strong>Труд (без ДДС):</strong></span><span><strong>${fmtBgnEur(taxBase)}</strong></span></div>
                   <div class="line"><span><strong>ДДС:</strong></span><span><strong>${fmtBgnEur(vatAmount)}</strong></span></div>
                   <div class="line"><span><strong>За плащане:</strong></span><span><strong>${fmtBgnEur(totalAmount)}</strong></span></div>
                 </div>
                </div>

              <div style="display:flex; justify-content: flex-end; margin-top: 10mm;">
                <div style="min-width: 80mm; text-align: left;">
                  <div class="meta"><strong>Съставил:</strong> ${escapeHtmlLocal(preparedBy || '—')}</div>
                </div>
              </div>
              </div>
            </div>
          </div>
        `;

        return `${makeProtocolPage(WATERMARK_ORIGINAL)}${makeProtocolPage(WATERMARK_COPY)}`;
      })
      .join('');

    const invoiceRowsHtml = lines
      .map(({ order, taxBase }, idx) => {
        const doc = docsByOrderId?.[order.id];
        const protocolNo = doc?.protocol_no || '';
        const desc = `Ремонт на превозно средство с регистрационен номер ${order.reg_number || ''} съгласно работна карта: ${protocolNo}`;
        return `
          <tr>
            <td style="text-align:center">${idx + 1}</td>
            <td>${escapeHtmlLocal(desc)}</td>
            <td>${escapeHtmlLocal(order.reg_number || '')}</td>
            <td style="text-align:right">1</td>
            <td style="text-align:right">${fmtBgnEurHtml(taxBase)}</td>
            <td style="text-align:right">${vatRate.toFixed(2)}%</td>
            <td style="text-align:right">${fmtBgnEurHtml(taxBase)}</td>
          </tr>
        `;
      })
      .join('');

    const totalsLocal = lines.reduce(
      (acc, x) => {
        acc.taxBase += Number(x?.taxBase) || 0;
        acc.vatAmount += Number(x?.vatAmount) || 0;
        acc.totalAmount += Number(x?.totalAmount) || 0;
        return acc;
      },
      { taxBase: 0, vatAmount: 0, totalAmount: 0 }
    );

    const taxBaseSum = Number(totalsLocal.taxBase) || 0;
    const vatSum = Number(totalsLocal.vatAmount) || 0;
    const totalSum = Number(totalsLocal.totalAmount) || 0;

    const makeInvoicePage = (watermarkLabel) => `
      <div class="page">
        <div class="watermark"><span>${escapeHtmlLocal(watermarkLabel)}</span></div>
        <div class="content">
          ${logoHtml ? `<div style="display:flex; justify-content:flex-end;">${logoHtml}</div>` : ''}
          <div class="grid2" style="margin-top: 6mm;">
            <div>
              <div class="meta" style="font-weight:800;">Получател:</div>
              <div style="border:1px solid #111; padding: 6px 8px; font-size: 12px;">
                <div><span class="k">Име на фирма:</span> <strong>${escapeHtmlLocal(resolvedRecipient.name)}</strong></div>
                <div><span class="k">ЕИК:</span> <strong>${escapeHtmlLocal(resolvedRecipient.eik)}</strong></div>
                <div><span class="k">ДДС №:</span> <strong>${escapeHtmlLocal(resolvedRecipient.vat_number)}</strong></div>
                <div><span class="k">Град:</span> <strong>${escapeHtmlLocal(resolvedRecipient.city)}</strong></div>
                <div><span class="k">Адрес:</span> <strong>${escapeHtmlLocal(resolvedRecipient.address)}</strong></div>
                <div><span class="k">МОЛ:</span> <strong>${escapeHtmlLocal(resolvedRecipient.mol)}</strong></div>
              </div>
            </div>
            <div>
              <div class="meta" style="font-weight:800;">Доставчик:</div>
              <div style="border:1px solid #111; padding: 6px 8px; font-size: 12px;">
                <div><span class="k">Име на фирма:</span> <strong>${escapeHtmlLocal(company.company_name)}</strong></div>
                <div><span class="k">ЕИК:</span> <strong>${escapeHtmlLocal(company.eik)}</strong></div>
                <div><span class="k">ДДС №:</span> <strong>${escapeHtmlLocal(company.vat_number)}</strong></div>
                <div><span class="k">Град:</span> <strong>${escapeHtmlLocal(company.city)}</strong></div>
                <div><span class="k">Адрес:</span> <strong>${escapeHtmlLocal(company.address)}</strong></div>
                <div><span class="k">МОЛ:</span> <strong>${escapeHtmlLocal(company.mol)}</strong></div>
              </div>
            </div>
          </div>

          <div style="text-align:center; margin-top: 8mm;">
            <div style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px;">Фактура</div>
            <div class="meta"><strong>No:</strong> ${escapeHtmlLocal(invoiceNo || '')}</div>
            <div class="meta"><span class="badge">${escapeHtmlLocal(watermarkLabel)}</span></div>
          </div>

          <div style="border-top: 2px solid #111; border-bottom: 2px solid #111; padding: 6px 0; margin-top: 4mm; display:flex; gap: 10mm; font-size: 12.5px;">
            <div><span class="k">Дата на издаване:</span> <strong>${escapeHtmlLocal(formatSqliteDateOnlyLocal(resolvedIssueDate))}</strong></div>
            <div><span class="k">Дата на дан. събитие:</span> <strong>${escapeHtmlLocal(formatSqliteDateOnlyLocal(resolvedIssueDate))}</strong></div>
            <div style="margin-left:auto;"><span class="k">Място на сделката:</span> <strong>${escapeHtmlLocal(company.city || '')}</strong></div>
          </div>

          <div style="margin-top: 6mm;">
            <table>
              <thead>
                <tr>
                  <th style="width:10mm; text-align:center;">No</th>
                  <th>Име на стоката/услугата</th>
                  <th style="width: 25mm;">Марка</th>
                  <th style="width: 14mm; text-align:right;">К-во</th>
                  <th style="width: 22mm; text-align:right;">Ед. цена</th>
                  <th style="width: 18mm; text-align:right;">ДДС (%)</th>
                  <th style="width: 26mm; text-align:right;">Стойност</th>
                </tr>
              </thead>
              <tbody>
                ${invoiceRowsHtml}
                <tr>
                  <td colspan="6" style="text-align:right; font-weight:700;">Данъчна основа (без ДДС):</td>
                  <td style="text-align:right; font-weight:700;">${fmtBgnEur(taxBaseSum)}</td>
                </tr>
                <tr>
                  <td colspan="6" style="text-align:right; font-weight:700;">Начислен ДДС (${vatRate.toFixed(2)} %):</td>
                  <td style="text-align:right; font-weight:700;">${fmtBgnEur(vatSum)}</td>
                </tr>
                <tr>
                  <td colspan="6" style="text-align:right; font-weight:900;">Сума за плащане:</td>
                  <td style="text-align:right; font-weight:900;">${fmtBgnEur(totalSum)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="display:flex; justify-content: space-between; gap: 18mm; margin-top: 10mm; font-size: 12.5px;">
            <div style="flex:1;">
              <div><span class="k">Начин на плащане:</span> <strong>${escapeHtmlLocal(company.payment_method || 'Банков път')}</strong></div>
              <div style="margin-top: 6px;"><span class="k">Банкови реквизити:</span></div>
              <div><strong>${escapeHtmlLocal(company.bank_name)}${company.bic ? `, BIC: ${escapeHtmlLocal(company.bic)}` : ''}</strong></div>
              <div><strong>${escapeHtmlLocal(company.iban)}</strong></div>
            </div>
            <div style="flex:1;">
              <div><span class="k">В евро:</span> <strong>${fmt2(toEur(totalSum))} EUR</strong></div>
              <div style="margin-top: 6px;"><span class="k">Основание:</span></div>
              <div class="muted">Групова фактура за ${lines.length} поръчки</div>
            </div>
          </div>

          <div style="display:flex; justify-content: flex-end; margin-top: 12mm;">
            <div style="min-width: 80mm; text-align: left;">
              <div class="meta"><strong>Съставил:</strong> ${escapeHtmlLocal(preparedBy || '—')}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    const pagesHtml = [
      protocolPagesHtml,
      makeInvoicePage(WATERMARK_ORIGINAL),
      makeInvoicePage(WATERMARK_COPY),
    ].join('');

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Групова фактура ${escapeHtmlLocal(invoiceNo || '')}</title>
      <style>
      @page { size: A4; margin: 14mm; }
      body {
        font-family: Arial, sans-serif;
        color: #111;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page { page-break-after: always; position: relative; min-height: 269mm; }
      .page:last-child { page-break-after: auto; }
      .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
      .watermark span { transform: rotate(-25deg); font-size: 92px; font-weight: 900; color: #000; opacity: 0.07; letter-spacing: 6px; text-transform: uppercase; }
      .content { position: relative; z-index: 1; padding-bottom: 16mm; }
      h1 { margin: 0 0 6px 0; font-size: 26px; font-weight: 900; letter-spacing: 0.3px; }
      .meta { font-size: 13px; color: #333; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { border: 1px solid #333; padding: 6px 8px; }
      th { background: #f5f5f5; text-align: left; }
      tbody tr:nth-child(even) td { background: #fafafa; }
      td.notes { min-height: 32px; vertical-align: top; white-space: pre-wrap; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18mm; }
      .block { border-top: 2px solid #111; }
      .block .title { background: #f5f5f5; font-weight: 900; padding: 4px 8px; text-align: center; border-bottom: 1px solid #ddd; }
      .rowline { display: grid; grid-template-columns: 110px 1fr; gap: 8px; padding: 4px 8px; border-bottom: 1px solid #cbd5e1; font-size: 12.5px; }
      .rowline .k { color: #334155; }
      .rowline .v { font-weight: 700; }
      .topbar { display: flex; justify-content: space-between; align-items: flex-start; }
      .summary { font-size: 13px; }
      .summary .line { display: flex; justify-content: space-between; padding: 4px 0; }
      .summary .big { font-size: 22px; font-weight: 900; }
      .muted { color: #555; }
      .badge { display: inline-block; border: 2px solid #111; padding: 2px 10px; font-weight: 900; letter-spacing: 1px; }
      @media print {
        body { margin: 0; }
      }
    </style>
  </head>
  <body>
    ${pagesHtml}
    <script>
      window.onload = function () {
        try { window.focus(); } catch (e) {}
        try { window.print(); } catch (e) {}
        window.onafterprint = function () {
          try { window.close(); } catch (e) {}
        };
      };
    </script>
  </body>
</html>`;

    const w = window.open('about:blank', '_blank');
    if (!w) {
      alert('Не може да се отвори прозорец за принтиране (popup blocker).');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const openExistingGroupInvoicePrint = async (invoiceNo) => {
    const inv = String(invoiceNo || '').trim();
    if (!inv) return;

    try {
      setGroupPreviewLoading(true);

      const ordersInGroup = (orders || []).filter(
        (o) => String(invoicedDocsByOrderId?.[o?.id]?.invoice_no || '').trim() === inv
      );
      const ids = ordersInGroup.map((o) => o.id).filter(Boolean);
      if (ids.length < 2) {
        alert('Не са намерени поръчки в групата.');
        return;
      }

      const wtMap = await loadWorktimesForManyOrders(ids);

      const docsByOrderId = {};
      ids.forEach((id) => {
        if (invoicedDocsByOrderId?.[id]) docsByOrderId[id] = invoicedDocsByOrderId[id];
      });

      const firstDoc = docsByOrderId[ids[0]];
      const issueDate = String(firstDoc?.issue_date || '').slice(0, 10);
      const multiplier =
        (Number(firstDoc?.mult_out_of_hours) || 1) *
        (Number(firstDoc?.mult_holiday) || 1) *
        (Number(firstDoc?.mult_out_of_service) || 1);

      const rec = await fetchRecipientForBulkClient(ordersInGroup);
      const resolvedRecipient = rec || bulkRecipientDraft;

      const hourlyRate = Number(company.hourly_rate) || 100;
      const vatRate = Number(company.vat_rate) || 20;

      const lines = ordersInGroup
        .map((o) => {
          const totalHours = Number(o?.total_hours) || 0;
          const freeOps = Number(o?.free_ops_amount_bgn) || 0;
          const taxBase = totalHours * hourlyRate * multiplier + freeOps;
          const vatAmount = taxBase * (vatRate / 100);
          const totalAmount = taxBase + vatAmount;
          return { order: o, taxBase, vatAmount, totalAmount };
        })
        .sort((a, b) => Number(b.order?.id) - Number(a.order?.id));

      openBulkInvoicePrint({
        docsByOrderId,
        worktimesByOrderId: wtMap,
        previewLines: lines,
        issueDate,
        recipient: resolvedRecipient,
        multiplierOverride: multiplier,
      });
    } catch (e) {
      alert(e?.response?.data?.error || 'Грешка при преглед на груповата фактура');
    } finally {
      setGroupPreviewLoading(false);
    }
  };

  const deleteGroupInvoiceByInvoiceNo = async (invoiceNo) => {
    const inv = String(invoiceNo || '').trim();
    if (!inv) return;
    if (!window.confirm(`Сигурни ли сте, че искате да изтриете груповата фактура №${inv}?`)) return;

    try {
      await axios.delete(`${getApiBaseUrl()}/orders/documents/by-invoice/${encodeURIComponent(inv)}`);
      // Refresh local doc map
      await loadOrderDocuments();
      setGroupFocusInvoiceNo('');
      alert('Груповата фактура е изтрита.');
    } catch (e) {
      alert(e?.response?.data?.error || 'Грешка при изтриване на груповата фактура.');
    }
  };

  const sendInvoiceEmailForDoc = async (docNumbers) => {
    if (!sendInvoiceByEmail) return;
    if (!selectedOrder) return;
    const to = String(invoiceEmailInputRef.current || invoiceEmailTo || '').trim();
    if (!to) {
      setEmailTooltipOpen(true);
      setTimeout(() => setEmailTooltipOpen(false), 4000);
      return;
    }

    try {
      setSendingInvoiceEmail(true);
      await axios.post(`${getApiBaseUrl()}/orders/${selectedOrder.id}/documents/email-invoice`, {
        to,
        recipient,
      });
    } catch (e) {
      alert('Грешка при изпращане на фактурата по имейл. Проверете SMTP настройките и имейл адреса.');
    } finally {
      setSendingInvoiceEmail(false);
    }
  };

  const invoicedDocForSelectedOrder = useMemo(() => {
    if (!selectedOrder?.id) return null;
    return invoicedDocsByOrderId?.[selectedOrder.id] || null;
  }, [selectedOrder?.id, invoicedDocsByOrderId]);

  const isSelectedOrderAlreadyInvoiced = Boolean(invoicedDocForSelectedOrder);

  const missingFreeOps = useMemo(() => {
    const rows = Array.isArray(orderWorktimes) ? orderWorktimes : [];
    return rows.filter((ow) => {
      const isFree = String(ow?.component_type || '').trim() === 'free_ops';
      if (!isFree) return false;
      const qty = Number(ow?.quantity) || 0;
      const price = Number(ow?.unit_price_bgn);
      return qty > 0 && (!Number.isFinite(price) || price <= 0);
    });
  }, [orderWorktimes]);

  const freeOpsNetPreview = useMemo(() => {
    const rows = Array.isArray(orderWorktimes) ? orderWorktimes : [];
    return rows
      .filter((ow) => String(ow?.component_type || '').trim() === 'free_ops')
      .reduce((sum, ow) => sum + (Number(ow?.unit_price_bgn) || 0) * (Number(ow?.quantity) || 0), 0);
  }, [orderWorktimes]);

  // NOTE: currently used only as an internal preview helper; keep build clean.
  void freeOpsNetPreview;

  const appliedMultiplierPreview = useMemo(() => {
    // If already invoiced, keep the stored multipliers (don’t allow changing pricing on an existing invoice).
    if (invoicedDocForSelectedOrder) {
      return (
        (Number(invoicedDocForSelectedOrder.mult_out_of_hours) || 1) *
        (Number(invoicedDocForSelectedOrder.mult_holiday) || 1) *
        (Number(invoicedDocForSelectedOrder.mult_out_of_service) || 1)
      );
    }

    // Otherwise compute from the currently selected checkboxes + company multipliers.
    const mOutOfHours = Number(company.price_multiplier_out_of_hours) || 1;
    const mHoliday = Number(company.price_multiplier_holiday) || 1;
    const mOutOfService = Number(company.price_multiplier_out_of_service) || 1;

    return (
      (multOutOfHoursChecked ? mOutOfHours : 1) *
      (multHolidayChecked ? mHoliday : 1) *
      (multOutOfServiceChecked ? mOutOfService : 1)
    );
  }, [
    invoicedDocForSelectedOrder,
    company.price_multiplier_out_of_hours,
    company.price_multiplier_holiday,
    company.price_multiplier_out_of_service,
    multOutOfHoursChecked,
    multHolidayChecked,
    multOutOfServiceChecked,
  ]);

  const effectiveHourlyRatePreview = useMemo(() => {
    const hourlyRate = Number(company.hourly_rate) || 100;
    return hourlyRate * appliedMultiplierPreview;
  }, [company.hourly_rate, appliedMultiplierPreview]);

  const openInvoicePrint = (docNumbers) => {
    if (!selectedOrder) return;
    const laborWorktimes = (orderWorktimes || []).filter(
      (ow) => String(ow?.component_type || '').trim() !== 'free_ops'
    );
    const freeOpsWorktimes = (orderWorktimes || []).filter(
      (ow) => String(ow?.component_type || '').trim() === 'free_ops'
    );

    const totalHours = laborWorktimes.reduce(
      (sum, ow) => sum + (Number(ow.hours) || 0) * (Number(ow.quantity) || 0),
      0
    );
    const freeOpsNet = freeOpsWorktimes.reduce(
      (sum, ow) => sum + (Number(ow.unit_price_bgn) || 0) * (Number(ow.quantity) || 0),
      0
    );
    const hourlyRate = Number(company.hourly_rate) || 100;
    const vatRate = Number(company.vat_rate) || 20;

    // Apply multipliers to the hourly rate.
    // NOTE: We intentionally do not print/show any text explaining the multipliers in the documents.
    // If the order is already invoiced, `appliedMultiplierPreview` is sourced from the stored invoice doc.
    const multiplier = Number(appliedMultiplierPreview) || 1;

    // Apply multipliers directly to the hourly rate, but do NOT mention them anywhere in the documents.
    const effectiveHourlyRate = hourlyRate * multiplier;

    // For protocol-only display: include equivalent hours derived from manual prices.
    // Equivalent free-ops hours = freeOpsNet / effectiveHourlyRate.
    const safeEffectiveHourlyRate = Math.max(0.000001, Number(effectiveHourlyRate) || 0.000001);
    const freeOpsHoursEqTotal = freeOpsNet / safeEffectiveHourlyRate;
    const protocolTotalHours = totalHours + freeOpsHoursEqTotal;

    // IMPORTANT: "Свободни Операции" are treated as LABOR (converted to equivalent hours).
    // Totals are presented as labor only.
    const laborTaxBase = protocolTotalHours * effectiveHourlyRate;
    const taxBase = laborTaxBase;
    const vatAmount = taxBase * (vatRate / 100);
    const totalAmount = taxBase + vatAmount;

    // Currency conversion (BGN -> EUR). Bulgaria uses a fixed peg: 1 EUR = 1.95583 BGN.
    const eurRate = Number(company.eur_rate) || 1.95583;
    const toEur = (bgn) => (Number(bgn) || 0) / eurRate;
    const fmt2 = (n) => (Number(n) || 0).toFixed(2);
    const fmtBgnEur = (bgn) => `${fmt2(bgn)} BGN / ${fmt2(toEur(bgn))} EUR`;

    const pad = (num, len) => String(num ?? '').padStart(len, '0');

    const workcardNo = selectedOrder.id;

    const protocolNo = docNumbers?.protocol_no || pad(workcardNo, 10);
    const invoiceNo = docNumbers?.invoice_no || `09${pad(workcardNo, 8)}`;
    const completedAt = selectedOrder.completed_at || selectedOrder.created_at;
    const issueDate = docNumbers?.issue_date || completedAt;

    const logoDataUrl = company.logo_data_url || '';
    const logoHtml = logoDataUrl
      ? `<img src="${escapeHtml(logoDataUrl)}" style="max-width:110px; max-height:110px; object-fit:contain;" />`
      : '';

    // Protocol rows (for print): for "Свободни Операции" show equivalent hours derived from entered price.
    // Equivalent total hours = (unit_price_bgn * quantity) / effectiveHourlyRate.
    const protocolRowHtmlItems = orderWorktimes.map((ow, idx) => {
      const isFreeOps = String(ow?.component_type || '').trim() === 'free_ops';
      const qty = Number(ow.quantity) || 0;
      const baseHours = Number(ow.hours) || 0;
      const unitPrice = Number(ow.unit_price_bgn) || 0;
      const hoursPerUnit = isFreeOps ? (unitPrice / safeEffectiveHourlyRate) : baseHours;
      const total = hoursPerUnit * qty;
      const notes = ow.notes ? escapeHtml(ow.notes) : '';
      return `
          <tr>
            <td style="text-align:center">${idx + 1}</td>
            <td>${escapeHtml(ow.worktime_title)}</td>
            <td class="notes">${notes}</td>
            <td style="text-align:right">${hoursPerUnit.toFixed(2).replace(/\.00$/, '')}</td>
            <td style="text-align:right">${qty}</td>
            <td style="text-align:right">${total.toFixed(2).replace(/\.00$/, '')}</td>
          </tr>
        `;
    });

    const effectiveType = vehicleTypeOverride || selectedVehicleType;
    const assetLabel =
      effectiveType === 'trailer' ? 'ремарке' : effectiveType === 'truck' ? 'автомобил' : 'превозно средство';

    const serviceDescription = `Ремонт на ${assetLabel} с регистрационен номер ${selectedOrder.reg_number} съгласно работна карта: ${protocolNo}`;

    // Invoice rows:
    // Single row only. We include manual-priced "Свободни Операции" inside the same row
    // by using `taxBase` (labor + free ops) as the net amount.
    const laborRowHtml = `
      <tr>
        <td style="text-align:center">1</td>
        <td>${escapeHtml(serviceDescription)}</td>
        <td>${escapeHtml(selectedOrder.reg_number || '')}</td>
        <td style="text-align:right">1</td>
        <td style="text-align:right">${taxBase.toFixed(2)}</td>
        <td style="text-align:right">${vatRate.toFixed(2)}%</td>
        <td style="text-align:right">${taxBase.toFixed(2)}</td>
      </tr>
    `;

    // IMPORTANT: Do not print a separate invoice row for "Свободни Операции".
    // Their value is included in `taxBase` and the totals, while details remain in the Protocol.
    const invoiceRowsHtml = `${laborRowHtml}`;

    // Print 2 copies of each document with a faint watermark.
    const WATERMARK_ORIGINAL = 'ОРИГИНАЛ';
    const WATERMARK_COPY = 'КОПИЕ';

    const chunkArray = (arr, size) => {
      const safeSize = Math.max(1, Number(size) || 1);
      const out = [];
      for (let i = 0; i < arr.length; i += safeSize) out.push(arr.slice(i, i + safeSize));
      return out.length ? out : [[]];
    };

    // Conservative row count to avoid overflow; if notes are very long the browser may still paginate further.
    const protocolRowsPerPage = 14;
    const protocolRowChunks = chunkArray(protocolRowHtmlItems, protocolRowsPerPage);

    const emptyProtocolRowHtml = '<tr><td colspan="6" class="muted">Няма добавени нормовремена</td></tr>';

    const makeProtocolPage = ({ watermarkLabel, pageNo, totalPages, rowsHtml }) => `
      <div class="page">
        <div class="watermark"><span>${escapeHtml(watermarkLabel)}</span></div>
        <div class="content">
          <div class="topbar">
            <div>
              <h1>Протокол</h1>
              <div class="meta"><strong>No:</strong> ${protocolNo}</div>
              <div class="meta"><strong>Към фактура No:</strong> ${invoiceNo}</div>
              <div class="meta"><span class="badge">${escapeHtml(watermarkLabel)}</span></div>
            </div>
            ${logoHtml}
          </div>

          <div class="grid2">
            <div class="block">
              <div class="title">Получател:</div>
              <div class="rowline"><div class="k">Име на фирма:</div><div class="v">${escapeHtml(recipient.name)}</div></div>
              <div class="rowline"><div class="k">ЕИК:</div><div class="v">${escapeHtml(recipient.eik)}</div></div>
              <div class="rowline"><div class="k">ДДС No:</div><div class="v">${escapeHtml(recipient.vat_number)}</div></div>
              <div class="rowline"><div class="k">Град:</div><div class="v">${escapeHtml(recipient.city)}</div></div>
              <div class="rowline"><div class="k">Адрес:</div><div class="v">${escapeHtml(recipient.address)}</div></div>
              <div class="rowline"><div class="k">МОЛ:</div><div class="v">${escapeHtml(recipient.mol)}</div></div>
            </div>
            <div class="block">
              <div class="title">Доставчик:</div>
              <div class="rowline"><div class="k">Име на фирма:</div><div class="v">${escapeHtml(company.company_name)}</div></div>
              <div class="rowline"><div class="k">ЕИК:</div><div class="v">${escapeHtml(company.eik)}</div></div>
              <div class="rowline"><div class="k">ДДС No:</div><div class="v">${escapeHtml(company.vat_number)}</div></div>
              <div class="rowline"><div class="k">Град:</div><div class="v">${escapeHtml(company.city)}</div></div>
              <div class="rowline"><div class="k">Адрес:</div><div class="v">${escapeHtml(company.address)}</div></div>
              <div class="rowline"><div class="k">МОЛ:</div><div class="v">${escapeHtml(company.mol)}</div></div>
            </div>
          </div>

          <div style="display:flex; justify-content: space-between; gap: 18mm; margin-top: 10mm;">
            <div style="flex:1;" class="summary">
              <div class="line"><span class="k">Дата на издаване:</span><span class="v">${escapeHtml(formatSqliteDateOnly(issueDate))}</span></div>
              <div class="line"><span class="k">Дата на дан. събитие:</span><span class="v">${escapeHtml(formatSqliteDateOnly(issueDate))}</span></div>
              <div class="line"><span class="k">Място на сделката:</span><span class="v">${escapeHtml(company.city || '')}</span></div>
              <div class="line"><span class="k">Рег. №:</span><span class="v">${escapeHtml(selectedOrder.reg_number)}</span></div>
            </div>
            <div style="flex:1;" class="summary">
              <div class="line"><span>Данъчна основа (${vatRate.toFixed(2)} %):</span><span><strong>${fmtBgnEur(taxBase)}</strong></span></div>
              <div class="line"><span>Начислен ДДС:</span><span><strong>${fmtBgnEur(vatAmount)}</strong></span></div>
              <div class="line" style="margin-top:6px;"><span><strong>Сума за плащане:</strong></span><span class="big">${fmtBgnEur(totalAmount)}</span></div>
            </div>
          </div>

          <div style="margin-top: 10mm;">
          <table>
            <thead>
              <tr>
                <th style="width: 10mm; text-align:center;">No</th>
                <th>Име на стоката/услугата</th>
                <th style="width: 55mm;">Бележки</th>
                <th style="width: 18mm; text-align:right;">Часове</th>
                <th style="width: 16mm; text-align:right;">К-во</th>
                <th style="width: 22mm; text-align:right;">Общо (ч.)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || emptyProtocolRowHtml}
            </tbody>
          </table>

          <div style="display:flex; justify-content: space-between; gap: 18mm; margin-top: 10mm;">
            <div style="flex:1;" class="summary">
              <div class="line"><span>Начин на плащане:</span><span><strong>${escapeHtml(company.payment_method || 'Банков път')}</strong></span></div>
              <div class="line"><span>Банкови реквизити:</span><span></span></div>
              <div class="line"><span></span><span><strong>${escapeHtml(company.bank_name)}${company.bic ? `, BIC: ${escapeHtml(company.bic)}` : ''}</strong></span></div>
              <div class="line"><span></span><span><strong>${escapeHtml(company.iban)}</strong></span></div>
            </div>
             <div style="flex:1;" class="summary">
               <div class="line"><span><strong>Труд (часове):</strong></span><span><strong>${protocolTotalHours.toFixed(2).replace(/\.00$/, '')} ч.</strong></span></div>
               <div class="line"><span><strong>Цена на час:</strong></span><span><strong>${fmtBgnEur(effectiveHourlyRate)}</strong></span></div>
               <div class="line"><span><strong>Труд (без ДДС):</strong></span><span><strong>${fmtBgnEur(laborTaxBase)}</strong></span></div>
               <div class="line"><span><strong>ДДС:</strong></span><span><strong>${fmtBgnEur(vatAmount)}</strong></span></div>
               <div class="line"><span><strong>За плащане:</strong></span><span><strong>${fmtBgnEur(totalAmount)}</strong></span></div>
             </div>
            </div>

          <div style="display:flex; justify-content: flex-end; margin-top: 10mm;">
            <div style="min-width: 80mm; text-align: left;">
              <div class="meta"><strong>Съставил:</strong> ${escapeHtml(preparedBy)}</div>
            </div>
          </div>
          </div>
        </div>

        <div class="page-footer">
          <div>Протокол №${protocolNo}</div>
          <div>${escapeHtml(watermarkLabel)} — стр. ${pageNo}/${totalPages}</div>
        </div>
      </div>
    `;

    const makeInvoicePage = (watermarkLabel) => `
      <div class="page">
        <div class="watermark"><span>${escapeHtml(watermarkLabel)}</span></div>
        <div class="content">
          ${logoHtml ? `<div style="display:flex; justify-content:flex-end;">${logoHtml}</div>` : ''}
          <div class="grid2" style="margin-top: 6mm;">
            <div>
              <div class="meta" style="font-weight:800;">Получател:</div>
              <div style="border:1px solid #111; padding: 6px 8px; font-size: 12px;">
                <div><span class="k">Име на фирма:</span> <strong>${escapeHtml(recipient.name)}</strong></div>
                <div><span class="k">ЕИК:</span> <strong>${escapeHtml(recipient.eik)}</strong></div>
                <div><span class="k">ДДС No:</span> <strong>${escapeHtml(recipient.vat_number)}</strong></div>
                <div><span class="k">Град:</span> <strong>${escapeHtml(recipient.city)}</strong></div>
                <div><span class="k">Адрес:</span> <strong>${escapeHtml(recipient.address)}</strong></div>
                <div><span class="k">МОЛ:</span> <strong>${escapeHtml(recipient.mol)}</strong></div>
              </div>
            </div>
            <div>
              <div class="meta" style="font-weight:800;">Доставчик:</div>
              <div style="border:1px solid #111; padding: 6px 8px; font-size: 12px;">
                <div><span class="k">Име на фирма:</span> <strong>${escapeHtml(company.company_name)}</strong></div>
                <div><span class="k">ЕИК:</span> <strong>${escapeHtml(company.eik)}</strong></div>
                <div><span class="k">ДДС No:</span> <strong>${escapeHtml(company.vat_number)}</strong></div>
                <div><span class="k">Град:</span> <strong>${escapeHtml(company.city)}</strong></div>
                <div><span class="k">Адрес:</span> <strong>${escapeHtml(company.address)}</strong></div>
                <div><span class="k">МОЛ:</span> <strong>${escapeHtml(company.mol)}</strong></div>
              </div>
            </div>
          </div>

          <div style="text-align:center; margin-top: 8mm;">
            <div style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px;">Фактура</div>
            <div class="meta"><strong>No:</strong> ${invoiceNo}</div>
            <div class="meta"><span class="badge">${escapeHtml(watermarkLabel)}</span></div>
          </div>

            <div style="border-top: 2px solid #111; border-bottom: 2px solid #111; padding: 6px 0; margin-top: 4mm; display:flex; gap: 10mm; font-size: 12.5px;">
            <div><span class="k">Дата на издаване:</span> <strong>${escapeHtml(formatSqliteDateOnly(issueDate))}</strong></div>
            <div><span class="k">Дата на дан. събитие:</span> <strong>${escapeHtml(formatSqliteDateOnly(issueDate))}</strong></div>
            <div style="margin-left:auto;"><span class="k">Място на сделката:</span> <strong>${escapeHtml(company.city || '')}</strong></div>
          </div>

          <div style="margin-top: 6mm;">
            <table>
              <thead>
                <tr>
                  <th style="width:10mm; text-align:center;">No</th>
                  <th>Име на стоката/услугата</th>
                  <th style="width: 25mm;">Марка</th>
                  <th style="width: 14mm; text-align:right;">К-во</th>
                  <th style="width: 22mm; text-align:right;">Ед. цена</th>
                  <th style="width: 18mm; text-align:right;">ДДС (%)</th>
                  <th style="width: 26mm; text-align:right;">Стойност</th>
                </tr>
              </thead>
              <tbody>
                ${invoiceRowsHtml || '<tr><td colspan="7" class="muted">Няма редове</td></tr>'}
                <tr>
                  <td colspan="6" style="text-align:right; font-weight:700;">Данъчна основа (без ДДС):</td>
                  <td style="text-align:right; font-weight:700;">${fmtBgnEur(taxBase)}</td>
                </tr>
                <tr>
                  <td colspan="6" style="text-align:right; font-weight:700;">Начислен ДДС (${vatRate.toFixed(2)} %):</td>
                  <td style="text-align:right; font-weight:700;">${fmtBgnEur(vatAmount)}</td>
                </tr>
                <tr>
                  <td colspan="6" style="text-align:right; font-weight:900;">Сума за плащане:</td>
                  <td style="text-align:right; font-weight:900;">${fmtBgnEur(totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="display:flex; justify-content: space-between; gap: 18mm; margin-top: 10mm; font-size: 12.5px;">
            <div style="flex:1;">
              <div><span class="k">Начин на плащане:</span> <strong>${escapeHtml(company.payment_method || 'Банков път')}</strong></div>
              <div style="margin-top: 6px;"><span class="k">Банкови реквизити:</span></div>
              <div><strong>${escapeHtml(company.bank_name)}${company.bic ? `, BIC: ${escapeHtml(company.bic)}` : ''}</strong></div>
              <div><strong>${escapeHtml(company.iban)}</strong></div>
            </div>
            <div style="flex:1;">
              <div><span class="k">Словом (BGN):</span> <strong>${escapeHtml(numberToBgWords(Math.round(totalAmount)))} лв.</strong></div>
              <div style="margin-top: 6px;"><span class="k">В евро:</span> <strong>${fmt2(toEur(totalAmount))} EUR</strong></div>
              <div style="margin-top: 6px;"><span class="k">Основание на сделка по ЗДДС:</span></div>
              <div class="muted">Работна карта №${workcardNo}</div>
            </div>
          </div>

          <div style="display:flex; justify-content: flex-end; margin-top: 12mm;">
            <div style="min-width: 80mm; text-align: left;">
              <div class="meta"><strong>Съставил:</strong> ${escapeHtml(preparedBy)}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    const makeProtocolPagesForCopy = (watermarkLabel) => {
      const totalPages = protocolRowChunks.length;
      return protocolRowChunks
        .map((chunk, idx) => {
          const rowsHtml = chunk.join('');
          const pageNo = idx + 1;
          return makeProtocolPage({ watermarkLabel, pageNo, totalPages, rowsHtml });
        })
        .join('');
    };

    const pagesHtml = [
      makeProtocolPagesForCopy(WATERMARK_ORIGINAL),
      makeProtocolPagesForCopy(WATERMARK_COPY),
      makeInvoicePage(WATERMARK_ORIGINAL),
      makeInvoicePage(WATERMARK_COPY),
    ].join('');

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Документи №${protocolNo}</title>
    <style>
      @page { size: A4; margin: 14mm; }
      body {
        font-family: Arial, sans-serif;
        color: #111;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page { page-break-after: always; position: relative; min-height: 269mm; }
      .page:last-child { page-break-after: auto; }
      .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
      .watermark span { transform: rotate(-25deg); font-size: 92px; font-weight: 900; color: #000; opacity: 0.07; letter-spacing: 6px; text-transform: uppercase; }
      .content { position: relative; z-index: 1; padding-bottom: 16mm; }
      h1 { margin: 0 0 6px 0; font-size: 26px; font-weight: 900; letter-spacing: 0.3px; }
      h2 { margin: 0 0 8px 0; font-size: 18px; }
      .meta { font-size: 13px; color: #333; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { border: 1px solid #333; padding: 6px 8px; }
      th { background: #f5f5f5; text-align: left; }
      tbody tr:nth-child(even) td { background: #fafafa; }
      td.notes { min-height: 32px; vertical-align: top; white-space: pre-wrap; }
      .totals { margin-top: 10px; display: flex; justify-content: flex-end; }
      .totals .box { border: 1px solid #333; padding: 10px 12px; font-size: 13px; min-width: 80mm; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18mm; }
      .block { border-top: 2px solid #111; }
      .block .title { background: #f5f5f5; font-weight: 900; padding: 4px 8px; text-align: center; border-bottom: 1px solid #ddd; }
      .rowline { display: grid; grid-template-columns: 110px 1fr; gap: 8px; padding: 4px 8px; border-bottom: 1px solid #cbd5e1; font-size: 12.5px; }
      .rowline .k { color: #334155; }
      .rowline .v { font-weight: 700; }
      .topbar { display: flex; justify-content: space-between; align-items: flex-start; }
      .logo { width: 110px; height: 110px; border: 2px solid #111; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; }
      .summary { font-size: 13px; }
      .summary .line { display: flex; justify-content: space-between; padding: 4px 0; }
      .summary .big { font-size: 22px; font-weight: 900; }
      .muted { color: #555; }
      .badge { display: inline-block; border: 2px solid #111; padding: 2px 10px; font-weight: 900; letter-spacing: 1px; }
      .page-footer { position: absolute; left: 0; right: 0; bottom: 0; border-top: 1px solid #ddd; padding-top: 2mm; font-size: 11px; display: flex; justify-content: space-between; color: #333; }
      @media print {
        body { margin: 0; }
      }
    </style>
  </head>
  <body>
    ${pagesHtml}

    <script>
      // Auto-open print dialog (no separate "print page" UX)
      window.onload = function () {
        try { window.focus(); } catch (e) {}
        try { window.print(); } catch (e) {}
        window.onafterprint = function () {
          try { window.close(); } catch (e) {}
        };
      };
    </script>

  </body>
</html>`;

    const w = window.open('about:blank', '_blank');
    if (!w) {
      // Fallback: print in a hidden iframe if popups are blocked.
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (!doc) {
        alert('Не може да се отвори прозорец/iframe за принтиране.');
        return;
      }
      doc.open();
      doc.write(html);
      doc.close();
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print?.();
          iframe.contentWindow.onafterprint = () => setTimeout(() => iframe.remove(), 250);
          setTimeout(() => iframe.remove(), 5000);
        } catch {
          setTimeout(() => iframe.remove(), 1000);
        }
      };
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const deleteInvoiceDocuments = async () => {
    if (!canDeleteInvoices) {
      alert('Нямате права да триете фактури.');
      return;
    }
    if (!selectedOrder?.id) return;

    const doc = invoicedDocsByOrderId?.[selectedOrder.id];
    if (!doc) {
      alert('Няма фактура за тази поръчка.');
      return;
    }

    const invoiceNoLabel = doc?.invoice_no ? `№${doc.invoice_no}` : '';
    if (!window.confirm(`Сигурни ли сте, че искате да изтриете фактурата ${invoiceNoLabel} за ${selectedOrder.reg_number}?`)) {
      return;
    }

    try {
      await axios.delete(`${getApiBaseUrl()}/orders/${selectedOrder.id}/documents`);
      setInvoicedDocsByOrderId((prev) => {
        const next = { ...(prev || {}) };
        delete next[selectedOrder.id];
        return next;
      });
      alert('Фактурата е изтрита успешно.');
    } catch (e) {
      alert(e?.response?.data?.error || 'Грешка при изтриване на фактурата.');
    }
  };

  const deleteUninvoicedOrder = async () => {
    if (!isAdmin) {
      alert('Само администратор може да трие поръчки.');
      return;
    }
    if (!selectedOrder?.id) return;

    const doc = invoicedDocsByOrderId?.[selectedOrder.id];
    if (doc) {
      alert('Тази поръчка вече е фактурирана. Първо изтрийте фактурата.');
      return;
    }

    if (!window.confirm(`Сигурни ли сте, че искате да изтриете НЕФАКТУРИРАНАТА поръчка за ${selectedOrder.reg_number}?`)) {
      return;
    }

    try {
      await axios.delete(`${getApiBaseUrl()}/orders/${selectedOrder.id}`);
      setOrders((prev) => (Array.isArray(prev) ? prev.filter((o) => o.id !== selectedOrder.id) : prev));
      setOrderDialogOpen(false);
      setSelectedOrder(null);
      alert('Поръчката е изтрита успешно.');
    } catch (e) {
      alert(e?.response?.data?.error || 'Грешка при изтриване на поръчката.');
    }
  };

  const saveWorktimeQuantity = async () => {
    if (!selectedOrder || !selectedOrderWorktime) return;
    try {
      const res = await axios.put(
        `${getApiBaseUrl()}/orders/${selectedOrder.id}/worktimes/${selectedOrderWorktime.id}`,
        { quantity: quantityDraft }
      );
      const updated = res.data;
      setSelectedOrderWorktime(updated);
      setOrderWorktimes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch {
      alert('Грешка при корекция на количеството');
    }
  };

  const openNotes = () => {
    if (!selectedOrderWorktime || !selectedOrder) return;
    setNotesDraft(selectedOrderWorktime.notes || '');
    setNotesDialogOpen(true);
  };

  const saveNotes = async () => {
    if (!selectedOrder || !selectedOrderWorktime) return;
    try {
      setSavingNotes(true);
      const res = await axios.put(
        `${getApiBaseUrl()}/orders/${selectedOrder.id}/worktimes/${selectedOrderWorktime.id}`,
        { notes: notesDraft }
      );
      const updated = res.data;
      setSelectedOrderWorktime(updated);
      setOrderWorktimes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch {
      alert('Грешка при запис на бележките');
    } finally {
      setSavingNotes(false);
      setNotesDialogOpen(false);
    }
  };

  // --- Free operations pricing helpers (manual unit price) ---
  const saveFreeOpsPrice = async () => {
    if (!selectedOrder || !selectedOrderWorktime) return;
    const isFreeOps = String(selectedOrderWorktime?.component_type || '').trim() === 'free_ops';
    if (!isFreeOps) return;

    const parsed = Number(String(priceDraft ?? '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      alert('Моля въведете валидна цена (> 0 лв) за „Свободни Операции“.');
      return;
    }

    try {
      setSavingPrice(true);
      const res = await axios.put(
        `${getApiBaseUrl()}/orders/${selectedOrder.id}/worktimes/${selectedOrderWorktime.id}`,
        { unit_price_bgn: parsed }
      );
      const updated = res?.data;
      setSelectedOrderWorktime(updated);
      setOrderWorktimes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      alert(e?.response?.data?.error || 'Грешка при запис на цена.');
    } finally {
      setSavingPrice(false);
    }
  };

  return (
    <Container
      maxWidth="xl"
      sx={{
        py: { xs: 1.25, md: 4 },
        // Prevent page-level horizontal scroll on mobile due to long chips/labels.
        overflowX: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'flex-end' },
          justifyContent: 'space-between',
          gap: 1.25,
          flexWrap: 'wrap',
          mb: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptLongIcon />
          <Typography variant={isPhone ? 'h5' : 'h4'} component="h1" sx={{ fontWeight: 900 }}>
            Фактури
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip
            label={`Нефактурирани: ${notInvoicedForCompleted}`}
            size="small"
            color="error"
            variant="outlined"
            sx={{ fontWeight: 900, ...WRAP_CHIP_SX }}
          />
          <Chip
            label={`Фактурирани: ${invoicedForCompleted}`}
            size="small"
            color="success"
            variant="outlined"
            sx={{ fontWeight: 900, ...WRAP_CHIP_SX }}
          />
          <Chip
            label={`Платени: ${paidForCompleted}`}
            size="small"
            color="warning"
            variant="outlined"
            icon={<PaidIcon />}
            sx={{ fontWeight: 900, ...WRAP_CHIP_SX }}
          />
        </Stack>
      </Box>

      {/* Filters */}
      <Paper variant="outlined" sx={{ mb: 1.5, p: { xs: 1, sm: 1.5 }, borderRadius: 2 }}>
        <Stack gap={1.25}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            alignItems={{ xs: 'stretch', md: 'center' }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 800 }}>
                Изглед
              </Typography>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(_, val) => {
                  if (!val) return;
                  setViewMode(val);
                  setMonthKey('all');
                }}
                size={isPhone ? 'small' : 'medium'}
                sx={{ flexWrap: 'wrap' }}
              >
                <ToggleButton value="current">Текущи</ToggleButton>
                <ToggleButton value="all">Всички</ToggleButton>
                <ToggleButton value="archive">Архив</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 800 }}>
                Сортиране
              </Typography>
              <ToggleButtonGroup
                value={sortMode}
                exclusive
                onChange={(_, val) => {
                  if (!val) return;
                  setSortMode(val);
                }}
                size={isPhone ? 'small' : 'medium'}
                sx={{ flexWrap: 'wrap' }}
              >
                <ToggleButton value="dateDesc">Нови</ToggleButton>
                <ToggleButton value="dateAsc">Стари</ToggleButton>
                <ToggleButton value="notInvoicedFirst">Нефакт.</ToggleButton>
                <ToggleButton value="invoicedFirst">Факт.</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Stack>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            alignItems="stretch"
          >
            <FormControl
              size={isPhone ? 'small' : 'medium'}
              sx={{ minWidth: { xs: '100%', md: 320 }, flex: { xs: '1 1 100%', md: '0 0 auto' } }}
            >
              <InputLabel id="invoices-month-label">Месец</InputLabel>
              <Select
                labelId="invoices-month-label"
                label="Месец"
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                renderValue={(val) => {
                  const selected = monthTabs.find((m) => m.key === val) || monthTabs[0];
                  return selected ? `${selected.label} (общо: ${selected.total})` : 'Всички';
                }}
              >
                {monthTabs.map((m) => (
                  <MenuItem key={m.key} value={m.key}>
                    <Box
                      sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontWeight: 900 }}>{m.label}</Typography>
                        <Chip label={`Общо: ${m.total}`} size="small" variant="outlined" />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                        <Chip
                          label={`Фактурирани: ${m.invoiced}`}
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ fontWeight: 900 }}
                        />
                        <Chip
                          label={`Нефактурирани: ${m.notInvoiced}`}
                          size="small"
                          color="error"
                          variant="outlined"
                          sx={{ fontWeight: 900 }}
                        />
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              size={isPhone ? 'small' : 'medium'}
              placeholder="Търси по рег. номер, клиент или оплакване..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              variant="outlined"
              sx={{ flex: '1 1 auto', minWidth: { xs: '100%', md: 360 } }}
            />
          </Stack>
        </Stack>
      </Paper>

      {/* Overview */}
      <Paper variant="outlined" sx={{ mb: 2, p: { xs: 1.25, sm: 2 }, borderRadius: 2, overflowX: 'hidden' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1, fontSize: isPhone ? 12.5 : undefined }}>
          Обобщение (по текущите филтри)
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '220px 1fr' },
            gap: 2,
            alignItems: 'center',
          }}
        >
          <Box
            sx={{
              width: { xs: 108, sm: 150 },
              height: { xs: 108, sm: 150 },
              borderRadius: '50%',
              mx: { xs: 'auto', md: 0 },
              background: (theme) => {
                const yellow = theme.palette.warning.main;
                const green = theme.palette.success.main;
                const red = theme.palette.error.main;
                const pctPaid = Math.min(100, Math.max(0, invoicingAmounts.pctPaid));
                const pctInvUnpaid = Math.min(100, Math.max(0, invoicingAmounts.pctInvoicedUnpaid));
                const cut1 = pctPaid;
                const cut2 = pctPaid + pctInvUnpaid;
                return `conic-gradient(${yellow} 0 ${cut1}%, ${green} ${cut1}% ${cut2}%, ${red} ${cut2}% 100%)`;
              },
              position: 'relative',
              border: (theme) => `2px solid ${theme.palette.divider}`,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                inset: { xs: 8, sm: 10 },
                borderRadius: '50%',
                backgroundColor: 'background.paper',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                textAlign: 'center',
              }}
            >
              <Typography sx={{ fontWeight: 900, fontSize: { xs: 16, sm: 18 } }}>
                {invoicingAmounts.totalCount}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                общо
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>
                платени: {invoicingAmounts.pctPaid.toFixed(1)}%
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gap: 1 }}>
            <Box
              sx={{
                // On phone: stack so the long BGN/EUR values are always visible.
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(4, minmax(0, 1fr))',
                },
                gap: 1,
                alignItems: 'center',
              }}
            >
              <Chip
                label={`Платени: ${formatBgnEur(invoicingAmounts.paidBgn)}`}
                color="warning"
                variant="outlined"
                size={isPhone ? 'small' : 'medium'}
                sx={{ fontWeight: 800, ...WRAP_CHIP_SX }}
              />
              <Chip
                label={`Фактурирани (неплатени): ${formatBgnEur(invoicingAmounts.invoicedUnpaidBgn)}`}
                color="success"
                variant="outlined"
                size={isPhone ? 'small' : 'medium'}
                sx={{ fontWeight: 800, ...WRAP_CHIP_SX }}
              />
              <Chip
                label={`Нефактурирани: ${formatBgnEur(invoicingAmounts.notInvoicedBgn)}`}
                color="error"
                variant="outlined"
                size={isPhone ? 'small' : 'medium'}
                sx={{ fontWeight: 800, ...WRAP_CHIP_SX }}
              />
              <Chip
                label={`Общо: ${formatBgnEur(invoicingAmounts.totalBgn)}`}
                variant="outlined"
                size={isPhone ? 'small' : 'medium'}
                sx={{ fontWeight: 900, ...WRAP_CHIP_SX }}
              />
            </Box>

            <Typography variant="body2" color="text.secondary">
              Процентно съотношение: <strong>{invoicingAmounts.pctPaid.toFixed(1)}%</strong> платени /{' '}
              <strong>{invoicingAmounts.pctInvoicedUnpaid.toFixed(1)}%</strong> фактурирани (неплатени) /{' '}
              <strong>{invoicingAmounts.pctNotInvoiced.toFixed(1)}%</strong> нефактурирани
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(5, 1fr)' },
                gap: 1,
                mt: 0.5,
              }}
            >
              <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                  Приключени
                </Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 18 }}>{totalCompleted}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                  Показани
                </Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 18 }}>{shownCompleted}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                  Днес
                </Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 18 }}>{completedTodayCount}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                  Клиенти
                </Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 18 }}>{uniqueClientsCount}</Typography>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                  Последни 7 дни
                </Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 18 }}>{completedLast7DaysCount}</Typography>
              </Paper>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Bulk invoicing */}
      <Paper variant="outlined" sx={{ mb: 2, p: { xs: 1.25, sm: 2 }, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', md: 'center' }}>
          <Box sx={{ flex: '1 1 auto' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
              Групово фактуриране
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Изберете клиент, маркирайте поръчки и направете една обща фактура.
            </Typography>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={bulkEnabled}
                onChange={(e) => {
                  const next = e.target.checked;
                  setBulkEnabled(next);
                  if (!next) {
                    setBulkClientKey('');
                    setBulkSelectedOrderIds([]);
                    setBulkMissingFreeOps([]);
                    setBulkWorktimesByOrderId({});
                  }
                }}
              />
            }
            label={bulkEnabled ? 'Включено' : 'Изключено'}
          />
        </Stack>

        {bulkEnabled ? (
          <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '420px 1fr' }, gap: 1.5 }}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                1) Клиент
              </Typography>

              <FormControl fullWidth size={isPhone ? 'small' : 'medium'}>
                <InputLabel id="bulk-client-label">Клиент</InputLabel>
                <Select
                  labelId="bulk-client-label"
                  label="Клиент"
                  value={bulkClientKey}
                  onChange={async (e) => {
                    const key = e.target.value;
                    setBulkClientKey(key);
                    setBulkSelectedOrderIds([]);
                    setBulkMissingFreeOps([]);
                    setBulkWorktimesByOrderId({});
                    const candidateOrders = bulkEligibleOrders.filter((o) => getClientKeyForOrder(o) === key);
                    const rec = await fetchRecipientForBulkClient(candidateOrders);
                    if (rec) setBulkRecipientDraft(rec);
                  }}
                  renderValue={(val) => {
                    const opt = bulkClientOptions.find((x) => x.key === val);
                    if (!opt) return '—';
                    return `${opt.client_name || '—'} (${opt.count})`;
                  }}
                >
                  {bulkClientOptions.map((opt) => (
                    <MenuItem key={opt.key} value={opt.key}>
                      <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Typography sx={{ fontWeight: 800, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {opt.client_name || '—'}
                        </Typography>
                        <Chip label={`${opt.count}`} size="small" variant="outlined" sx={{ fontWeight: 900 }} />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ mt: 1.25, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
                <TextField
                  label="Дата на фактуриране"
                  type="date"
                  value={bulkIssueDateDraft}
                  onChange={(e) => setBulkIssueDateDraft(e.target.value)}
                  fullWidth
                  size={isPhone ? 'small' : 'medium'}
                  InputLabelProps={{ shrink: true }}
                  helperText="Дата, която ще се отпечата във фактурата/протоколите."
                />
                <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, display: 'block' }}>
                    Коефициенти
                  </Typography>
                  <FormControlLabel
                    control={<Checkbox checked={bulkMultOutOfHoursChecked} onChange={(e) => setBulkMultOutOfHoursChecked(e.target.checked)} />}
                    label={`Извън раб. време (x${Number(company.price_multiplier_out_of_hours) || 1})`}
                    sx={{ mr: 0 }}
                  />
                  <FormControlLabel
                    control={<Checkbox checked={bulkMultHolidayChecked} onChange={(e) => setBulkMultHolidayChecked(e.target.checked)} />}
                    label={`Почивен ден (x${Number(company.price_multiplier_holiday) || 1})`}
                    sx={{ mr: 0 }}
                  />
                  <FormControlLabel
                    control={<Checkbox checked={bulkMultOutOfServiceChecked} onChange={(e) => setBulkMultOutOfServiceChecked(e.target.checked)} />}
                    label={`Извън сервиз (x${Number(company.price_multiplier_out_of_service) || 1})`}
                    sx={{ mr: 0 }}
                  />
                </Paper>
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                  2) Поръчки за включване
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={!bulkClientKey || bulkOrdersForSelectedClient.length === 0}
                    onClick={() => setBulkSelectedOrderIds(bulkOrdersForSelectedClient.map((o) => o.id))}
                  >
                    Избери всички
                  </Button>
                  <Button size="small" variant="outlined" disabled={bulkSelectedOrderIds.length === 0} onClick={() => setBulkSelectedOrderIds([])}>
                    Изчисти
                  </Button>
                </Stack>
              </Box>

              {!bulkClientKey ? (
                <Typography variant="body2" color="text.secondary">
                  Изберете клиент.
                </Typography>
              ) : bulkOrdersForSelectedClient.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Няма нефактурирани приключени поръчки за този клиент (според текущия „Изглед/Месец“).
                </Typography>
              ) : (
                <List dense sx={{ p: 0 }}>
                  {bulkOrdersForSelectedClient.map((o, idx) => {
                    const checked = bulkSelectedOrderIds.includes(o.id);
                    const completedAt = o.completed_at || o.created_at;
                    return (
                      <div key={o.id}>
                        <ListItem
                          button
                          onClick={() => {
                            setBulkSelectedOrderIds((prev) => {
                              const set = new Set(prev);
                              if (set.has(o.id)) set.delete(o.id);
                              else set.add(o.id);
                              return Array.from(set);
                            });
                          }}
                          sx={{ borderRadius: 2, border: (theme) => `1px solid ${theme.palette.divider}` }}
                        >
                          <Checkbox checked={checked} tabIndex={-1} disableRipple />
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                <Typography sx={{ fontWeight: 900 }}>#{o.id} • {o.reg_number}</Typography>
                                <Typography sx={{ fontWeight: 900, whiteSpace: 'nowrap' }}>{(Number(o.total_amount_bgn) || 0).toFixed(2)} лв</Typography>
                              </Box>
                            }
                            secondary={`Приключена: ${formatSqliteDateTime(completedAt)}`}
                          />
                        </ListItem>
                        {idx < bulkOrdersForSelectedClient.length - 1 ? <Divider sx={{ my: 0.75 }} /> : null}
                      </div>
                    );
                  })}
                </List>
              )}

              <Box sx={{ mt: 1.25, display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={bulkSelectedOrderIds.length < 2}
                  onClick={async () => {
                    try {
                      setBulkPreviewOpen(true);
                      setBulkPreviewLoading(true);
                      const ids = [...bulkSelectedOrderIds];
                      const wtMap = await loadWorktimesForManyOrders(ids);
                      setBulkWorktimesByOrderId(wtMap);
                const missing = [];
                ids.forEach((id) => {
                  const rows = Array.isArray(wtMap?.[id]) ? wtMap[id] : [];
                  rows
                    .filter((r) => String(r?.component_type || '').trim() === 'free_ops')
                    .forEach((r) => {
                      const qty = Number(r?.quantity) || 0;
                      const price = Number(r?.unit_price_bgn);
                      if (qty > 0 && (!Number.isFinite(price) || price <= 0)) {
                        missing.push({
                          order_id: id,
                          order_worktime_id: r?.id,
                          title: r?.worktime_title || '',
                          quantity: qty,
                          unit_price_bgn: r?.unit_price_bgn,
                        });
                      }
                    });
                });
                setBulkMissingFreeOps(missing);
                    } finally {
                      setBulkPreviewLoading(false);
                    }
                  }}
                >
                  Преглед
                </Button>
              </Box>
            </Paper>
          </Box>
        ) : null}
      </Paper>

      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant={isPhone ? 'subtitle1' : 'h6'} sx={{ fontWeight: 900 }}>
          Приключени поръчки
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Показани: <strong>{filteredOrders.length}</strong>
        </Typography>
      </Box>

      {String(groupFocusInvoiceNo || '').trim() ? (
        <Paper
          variant="outlined"
          sx={{ mb: 1.25, p: 1.25, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900 }}>
              Филтър: групова фактура №{String(groupFocusInvoiceNo).trim()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Показват се само поръчките от тази група.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ ml: 'auto' }}>
            <Button
              variant="contained"
              onClick={() => openExistingGroupInvoicePrint(groupFocusInvoiceNo)}
              disabled={groupPreviewLoading}
            >
              {groupPreviewLoading ? 'Зареждане...' : 'Преглед на фактурата'}
            </Button>
            {isAdmin ? (
              <Button
                variant="outlined"
                color="error"
                onClick={() => deleteGroupInvoiceByInvoiceNo(groupFocusInvoiceNo)}
              >
                Изтрий групова фактура
              </Button>
            ) : null}
            <Button variant="outlined" onClick={() => setGroupFocusInvoiceNo('')}>
              Изчисти филтъра
            </Button>
          </Stack>
        </Paper>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 1.25,
          mb: 1.5,
        }}
      >
        {filteredOrders.map((o) => {
          const doc = invoicedDocsByOrderId?.[o.id];
          const status = getInvoiceStatusMeta(o);
          const isInvoiced = Boolean(doc);
          const isPaid = Number(doc?.is_paid) === 1;
          const invNo = String(doc?.invoice_no || '').trim();
          const groupMeta = invNo ? invoiceGroupMetaByInvoiceNo.get(invNo) : null;
          const isGroupInvoice = Boolean(groupMeta && Number(groupMeta.count) > 1);
          const completedAt = o.completed_at || o.created_at;
          const amountParts = getBgnEurParts(o.total_amount_bgn);

          return (
            <Card
              key={o.id}
              variant="outlined"
              sx={{
                borderWidth: 2,
                borderColor: status.borderColor,
                backgroundColor: status.bg,
                overflow: 'hidden',
              }}
            >
              <CardActionArea
                onClick={() => openOrder(o)}
                sx={{
                  p: { xs: 1.1, sm: 1.5 },
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="flex-start" justifyContent="space-between">
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                      <AssignmentIcon color="primary" fontSize="small" />
                      <Typography
                        variant={isPhone ? 'subtitle1' : 'h6'}
                        sx={{ fontWeight: 900, letterSpacing: 0.2 }}
                      >
                        {o.reg_number}
                      </Typography>
                      <Chip label={status.label} size="small" color={status.color} variant="outlined" sx={{ fontWeight: 900 }} />
                      {isInvoiced && !isPhone ? (
                        <Chip
                          label={doc?.invoice_no ? `№${doc.invoice_no}` : '№—'}
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 800 }}
                        />
                      ) : null}
                      {isGroupInvoice ? (
                        <Tooltip title="Групова фактура – покажи всички поръчки от групата">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setGroupFocusInvoiceNo(invNo);
                            }}
                            startIcon={<LinkIcon />}
                            sx={{ fontWeight: 900 }}
                          >
                            Група
                          </Button>
                        </Tooltip>
                      ) : null}
                      {isInvoiced ? <CheckCircleIcon sx={{ color: 'success.main', fontSize: 18 }} /> : null}
                      {isPaid ? <PaidIcon sx={{ color: 'warning.main', fontSize: 18 }} /> : null}
                    </Stack>

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontWeight: 700 }}>
                      Клиент: {o.client_name || '—'}
                    </Typography>

                    {o.complaint ? (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={o.complaint}
                      >
                        Оплакване: {o.complaint}
                      </Typography>
                    ) : null}

                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`Приключена: ${formatSqliteDateTime(completedAt)}`}
                        sx={{ maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                      />
                      {doc?.created_at ? (
                        <Chip
                          size="small"
                          color="success"
                          variant="outlined"
                          label={`Фактурирана: ${formatSqliteDateTime(doc.created_at)}`}
                          sx={{ fontWeight: 800 }}
                        />
                      ) : null}
                    </Stack>
                  </Box>

                  <Box sx={{ textAlign: 'right', flex: '0 0 auto' }}>
                    <Typography
                      sx={{
                        fontWeight: 900,
                        fontSize: { xs: 14.5, sm: 16 },
                        lineHeight: 1.1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {amountParts.bgn}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: 'block',
                        fontWeight: 800,
                        lineHeight: 1.1,
                        whiteSpace: 'nowrap',
                        mt: 0.25,
                      }}
                    >
                      {amountParts.eur}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                      Раб. карта №{o.id}
                    </Typography>
                  </Box>
                </Stack>
              </CardActionArea>

              {isInvoiced && !isPaid ? (
                <CardActions sx={{ px: { xs: 1.1, sm: 1.5 }, pb: 1.25, pt: 0.5, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    color="warning"
                    startIcon={<PaidIcon />}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openMarkPaidConfirm(o);
                    }}
                  >
                    Отбележи „Платена"
                  </Button>
                </CardActions>
              ) : null}
            </Card>
          );
        })}

        {filteredOrders.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, gridColumn: '1 / -1' }}>
            <Typography sx={{ fontWeight: 900 }}>Няма резултати</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Пробвайте да изчистите търсенето или да смените „Изглед“ / „Месец“.
            </Typography>
          </Paper>
        ) : null}
      </Box>

      {/* Order correction dialog */}
      <Dialog
        open={orderDialogOpen}
        onClose={() => setOrderDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        fullScreen={fullScreenDialog}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptLongIcon color="primary" />
          Корекции преди фактуриране – {selectedOrder?.reg_number}
        </DialogTitle>
        <DialogContent>
          {selectedOrder && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                  Оплакване (може да се коригира)
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  value={complaintDraft}
                  onChange={(e) => setComplaintDraft(e.target.value)}
                />
                <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    onClick={saveOrderEdits}
                    disabled={savingOrder}
                    startIcon={<EditIcon />}
                  >
                    Запази корекция
                  </Button>
                </Box>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    Добавени нормовремена ({orderWorktimes.length})
                  </Typography>
                  <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={openAddWorktimeDialog}>
                    Добави
                  </Button>
                </Box>

                <List dense sx={{ p: 0 }}>
                  {orderWorktimes.map((ow, idx) => {
                    const isFreeOps = String(ow?.component_type || '').trim() === 'free_ops';
                    const unitPrice = Number(ow?.unit_price_bgn) || 0;
                    const total = (ow.hours || 0) * (ow.quantity || 0);
                    return (
                      <div key={ow.id}>
                        <ListItem
                          button
                          onClick={() => openWorktimeDetails(ow)}
                          sx={{
                            borderRadius: 2,
                            mb: 0.75,
                            border: (theme) =>
                              ow.notes
                                ? `2px solid ${theme.palette.warning.main}`
                                : `1px solid ${theme.palette.divider}`,
                          }}
                        >
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography sx={{ fontWeight: 700 }}>{ow.worktime_title}</Typography>
                                <Chip
                                  label={`${total.toFixed(2).replace(/\.00$/, '')}ч`}
                                  size="small"
                                  color="primary"
                                  sx={{ fontWeight: 800 }}
                                />
                              </Box>
                            }
                            secondary={
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mt: 0.25 }}>
                                  <Chip label={ow.component_type} size="small" variant="outlined" />
                                  <Chip
                                    label={formatCategoryLabel(categoryVehicleType, ow.component_type)}
                                    size="small"
                                    variant="outlined"
                                  />
                                  {isFreeOps ? (
                                    <Chip label="Без нормовреме" size="small" variant="outlined" />
                                  ) : (
                                    <Chip label={`${ow.hours}ч`} size="small" variant="outlined" />
                                  )}
                                  <Chip label={`x${ow.quantity}`} size="small" variant="outlined" />
                                  {isFreeOps ? (
                                    <Chip
                                      label={unitPrice > 0 ? `Цена: ${unitPrice.toFixed(2)} лв` : 'Липсва цена'}
                                      size="small"
                                      color={unitPrice > 0 ? 'success' : 'error'}
                                      variant={unitPrice > 0 ? 'outlined' : 'filled'}
                                      sx={{ fontWeight: 900 }}
                                    />
                                  ) : null}
                                {ow.notes ? (
                                  <StickyNote2Icon
                                    titleAccess="Има бележка"
                                    sx={{ color: 'warning.main', fontSize: 18 }}
                                  />
                                ) : null}
                              </Box>
                            }
                          />
                        </ListItem>
                        {idx < orderWorktimes.length - 1 && <Divider sx={{ my: 0.25 }} />}
                      </div>
                    );
                  })}
                  {orderWorktimes.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      Няма добавени нормовремена.
                    </Typography>
                  )}
                </List>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {canDeleteInvoices && selectedOrder && invoicedDocsByOrderId?.[selectedOrder.id] ? (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={deleteInvoiceDocuments}
            >
              Изтрий фактура
            </Button>
          ) : null}

          {isAdmin && selectedOrder && !invoicedDocsByOrderId?.[selectedOrder.id] ? (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={deleteUninvoicedOrder}
            >
              Изтрий поръчка (нефактурирана)
            </Button>
          ) : null}
          <Button onClick={() => setOrderDialogOpen(false)}>Затвори</Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<ReceiptLongIcon />}
            onClick={() => setInvoiceConfirmOpen(true)}
            disabled={!selectedOrder}
          >
            Фактуриране
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk invoice preview */}
      <Dialog
        open={bulkPreviewOpen}
        onClose={() => {
          if (bulkGenerating) return;
          setBulkPreviewOpen(false);
        }}
        maxWidth="md"
        fullWidth
        fullScreen={fullScreenDialog}
      >
        <DialogTitle sx={{ fontWeight: 900 }}>
          Преглед – групова фактура
        </DialogTitle>
        <DialogContent>
          {bulkPreviewLoading ? (
            <Typography sx={{ fontWeight: 800 }}>Зареждане...</Typography>
          ) : (
            <Box sx={{ display: 'grid', gap: 1.25 }}>
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 0.5 }}>
                  Обобщение
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Клиент: <strong>{bulkRecipientDraft.name || '—'}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Поръчки: <strong>{bulkPreviewLines.length}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Данъчна основа: <strong>{bulkPreviewTotals.taxBase.toFixed(2)} лв</strong> • ДДС: <strong>{bulkPreviewTotals.vatAmount.toFixed(2)} лв</strong> • Общо: <strong>{bulkPreviewTotals.totalAmount.toFixed(2)} лв</strong>
                </Typography>
              </Paper>

              {bulkMissingFreeOps.length ? (
                <Paper
                  variant="outlined"
                  sx={{ p: 1.5, borderRadius: 2, borderColor: 'error.main', bgcolor: (theme) => theme.palette.error.main + '08' }}
                >
                  <Typography sx={{ fontWeight: 900, color: 'error.main' }}>
                    Липсва цена за „Свободни Операции“
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    Генерирането е блокирано докато не се въведе цена за тези позиции:
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 1, mt: 1 }}>
                    {bulkMissingFreeOps.slice(0, 10).map((x, idx) => {
                      const rowId = Number(x?.order_worktime_id);
                      const orderId = Number(x?.order_id);
                      const draft = bulkFreeOpsPriceDraftByRowId?.[rowId] ?? '';
                      const saving = bulkFreeOpsSavingRowId === rowId;
                      return (
                        <Paper key={`${x.order_id}-${rowId || idx}`} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 900 }}>
                            Поръчка #{orderId}: {x.title || '—'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                            Количество: x{Number(x?.quantity) || 0}
                          </Typography>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                            <TextField
                              label="Ед. цена (лв) *"
                              size="small"
                              type="number"
                              value={draft}
                              onChange={(e) =>
                                setBulkFreeOpsPriceDraftByRowId((prev) => ({
                                  ...(prev || {}),
                                  [rowId]: e.target.value,
                                }))
                              }
                              inputProps={{ min: 0, step: '0.01' }}
                              sx={{ width: { xs: '100%', sm: 220 } }}
                              disabled={!rowId || saving}
                            />
                            <Button
                              variant="contained"
                              onClick={() => saveBulkFreeOpsPrice({ orderId, orderWorktimeId: rowId })}
                              disabled={!rowId || saving}
                            >
                              {saving ? 'Запис...' : 'Запази цена'}
                            </Button>
                          </Stack>
                        </Paper>
                      );
                    })}
                    {bulkMissingFreeOps.length > 10 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        + още {bulkMissingFreeOps.length - 10}
                      </Typography>
                    ) : null}
                  </Box>
                </Paper>
              ) : null}

              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                  Поръчки във фактурата
                </Typography>
                <List dense sx={{ p: 0 }}>
                  {bulkPreviewLines.map(({ order, taxBase, vatAmount, totalAmount }, idx) => (
                    <div key={order.id}>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText
                          primary={<Typography sx={{ fontWeight: 900 }}>#{order.id} • {order.reg_number}</Typography>}
                          secondary={
                            <Typography variant="body2" color="text.secondary">
                              Основа: {taxBase.toFixed(2)} лв • ДДС: {vatAmount.toFixed(2)} лв • Общо: {totalAmount.toFixed(2)} лв
                            </Typography>
                          }
                        />
                      </ListItem>
                      {idx < bulkPreviewLines.length - 1 ? <Divider sx={{ my: 0.5 }} /> : null}
                    </div>
                  ))}
                </List>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                  Получател (може да се коригира)
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1.25 }}>
                  <TextField
                    label="Име на фирма"
                    value={bulkRecipientDraft.name}
                    onChange={(e) => setBulkRecipientDraft((prev) => ({ ...prev, name: e.target.value }))}
                    fullWidth
                  />
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
                    <TextField
                      label="ЕИК"
                      value={bulkRecipientDraft.eik}
                      onChange={(e) => setBulkRecipientDraft((prev) => ({ ...prev, eik: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label="ДДС №"
                      value={bulkRecipientDraft.vat_number}
                      onChange={(e) => setBulkRecipientDraft((prev) => ({ ...prev, vat_number: e.target.value }))}
                      fullWidth
                    />
                  </Box>
                  <TextField
                    label="Град"
                    value={bulkRecipientDraft.city}
                    onChange={(e) => setBulkRecipientDraft((prev) => ({ ...prev, city: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Адрес"
                    value={bulkRecipientDraft.address}
                    onChange={(e) => setBulkRecipientDraft((prev) => ({ ...prev, address: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="МОЛ"
                    value={bulkRecipientDraft.mol}
                    onChange={(e) => setBulkRecipientDraft((prev) => ({ ...prev, mol: e.target.value }))}
                    fullWidth
                  />
                </Box>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setBulkPreviewOpen(false)}
            disabled={bulkGenerating}
          >
            Затвори
          </Button>
          <Button
            variant="contained"
            color="success"
            disabled={
              bulkGenerating ||
              bulkPreviewLoading ||
              bulkPreviewLines.length < 2 ||
              bulkMissingFreeOps.length > 0 ||
              !String(bulkIssueDateDraft || '').trim()
            }
            onClick={async () => {
              try {
                setBulkGenerating(true);
                const ids = bulkPreviewLines.map((x) => x.order.id);
                const result = await reserveBulkDocumentNumbers({ orderIds: ids });
                const docs = Array.isArray(result?.docs) ? result.docs : [];
                const docsByOrderId = {};
                docs.forEach((d) => {
                  if (d?.order_id != null) docsByOrderId[d.order_id] = d;
                });

                setInvoicedDocsByOrderId((prev) => {
                  const next = { ...(prev || {}) };
                  docs.forEach((d) => {
                    if (d?.order_id != null) next[d.order_id] = d;
                  });
                  return next;
                });

                setBulkPreviewOpen(false);

                openBulkInvoicePrint({
                  docsByOrderId,
                  worktimesByOrderId: bulkWorktimesByOrderId,
                });
              } catch (e) {
                alert(e?.response?.data?.error || 'Грешка при генериране на групова фактура');
              } finally {
                setBulkGenerating(false);
              }
            }}
          >
            {bulkGenerating ? 'Генериране...' : 'Генерирай групова фактура'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Invoice confirmation */}
      <Dialog open={invoiceConfirmOpen} onClose={() => setInvoiceConfirmOpen(false)} maxWidth="md" fullWidth fullScreen={fullScreenDialog}>
        <DialogTitle sx={{ fontWeight: 800 }}>Потвърждение</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            Да се генерират ли документите за принтиране (4 × A4: Протокол – Оригинал/Копие, Фактура – Оригинал/Копие) за тази поръчка?
          </Typography>

          <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                Получател (от Клиент – може да се коригира)
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1.25 }}>
                <TextField
                  label="Име на фирма"
                  value={recipient.name}
                  onChange={(e) => setRecipient({ ...recipient, name: e.target.value })}
                  fullWidth
                />
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
                  <TextField
                    label="ЕИК"
                    value={recipient.eik}
                    onChange={(e) => setRecipient({ ...recipient, eik: e.target.value })}
                    fullWidth
                  />
                  <TextField
                    label="ДДС №"
                    value={recipient.vat_number}
                    onChange={(e) => setRecipient({ ...recipient, vat_number: e.target.value })}
                    fullWidth
                  />
                </Box>
                <TextField
                  label="Град"
                  value={recipient.city}
                  onChange={(e) => setRecipient({ ...recipient, city: e.target.value })}
                  fullWidth
                />
                <TextField
                  label="Адрес"
                  value={recipient.address}
                  onChange={(e) => setRecipient({ ...recipient, address: e.target.value })}
                  fullWidth
                />
                <TextField
                  label="МОЛ"
                  value={recipient.mol}
                  onChange={(e) => setRecipient({ ...recipient, mol: e.target.value })}
                  fullWidth
                />
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                Обобщение
              </Typography>

              <TextField
                label="Дата на фактуриране"
                type="date"
                value={invoiceIssueDateDraft}
                onChange={(e) => setInvoiceIssueDateDraft(e.target.value)}
                fullWidth
                sx={{ mb: 1.25 }}
                InputLabelProps={{ shrink: true }}
                helperText={isSelectedOrderAlreadyInvoiced ? 'Поръчката вече е фактурирана – датата не може да се променя.' : 'Дата, която ще се отпечата във фактурата/протокола.'}
                disabled={reservingDocs || isSelectedOrderAlreadyInvoiced}
              />

              <TextField
                select
                label="Тип (за текста във фактурата)"
                value={vehicleTypeOverride || selectedVehicleType || ''}
                onChange={(e) => setVehicleTypeOverride(e.target.value)}
                fullWidth
                sx={{ mb: 1.25 }}
                helperText={
                  selectedVehicleType
                    ? 'Зареден автоматично от „Превозни средства“. Може да се коригира.'
                    : 'Не е открито автоматично – моля изберете.'
                }
              >
                <MenuItem value="">—</MenuItem>
                <MenuItem value="truck">Автомобил</MenuItem>
                <MenuItem value="trailer">Ремарке</MenuItem>
              </TextField>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Работна карта № <strong>{selectedOrder?.id}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Цена на час: <strong>{effectiveHourlyRatePreview.toFixed(2)} лв/ч</strong>
              </Typography>
               {/* Free ops are treated as labor; avoid showing a separate line here to match document summaries. */}
              <Typography variant="body2" color="text.secondary">
                ДДС: <strong>{Number(company.vat_rate) || 20}%</strong>
              </Typography>

              {missingFreeOps.length ? (
                <Paper
                  variant="outlined"
                  sx={{
                    mt: 1.25,
                    p: 1.25,
                    borderRadius: 2,
                    borderColor: 'error.main',
                    bgcolor: (theme) => theme.palette.error.main + '08',
                  }}
                >
                  <Typography sx={{ fontWeight: 900, color: 'error.main' }}>
                    Липсва цена за „Свободни Операции“
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    Фактуриране няма да е възможно докато не се въведе цена за тези позиции:
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.25, mt: 0.75 }}>
                    {missingFreeOps.slice(0, 6).map((x) => (
                      <li key={x.id}>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          {x.worktime_title}
                        </Typography>
                      </li>
                    ))}
                    {missingFreeOps.length > 6 ? (
                      <li>
                        <Typography variant="body2" color="text.secondary">
                          + още {missingFreeOps.length - 6}
                        </Typography>
                      </li>
                    ) : null}
                  </Box>
                </Paper>
              ) : null}

              <Box sx={{ mt: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
                  Коефициенти (множители)
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={multOutOfHoursChecked}
                      onChange={(e) => setMultOutOfHoursChecked(e.target.checked)}
                      disabled={isSelectedOrderAlreadyInvoiced}
                    />
                  }
                  label={`Извън работно време (x${Number(company.price_multiplier_out_of_hours) || 1})`}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={multHolidayChecked}
                      onChange={(e) => setMultHolidayChecked(e.target.checked)}
                      disabled={isSelectedOrderAlreadyInvoiced}
                    />
                  }
                  label={`Почивен ден (x${Number(company.price_multiplier_holiday) || 1})`}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={multOutOfServiceChecked}
                      onChange={(e) => setMultOutOfServiceChecked(e.target.checked)}
                      disabled={isSelectedOrderAlreadyInvoiced}
                    />
                  }
                  label={`Извън сервиз (x${Number(company.price_multiplier_out_of_service) || 1})`}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                „Съставил“ ще се попълни автоматично от настройките на акаунта ({preparedBy || '—'}).
              </Typography>

              <Box sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={sendInvoiceByEmail}
                      onChange={(e) => setSendInvoiceByEmail(e.target.checked)}
                    />
                  }
                  label="Изпрати документите по имейл (PDF файлове)"
                />

                {sendInvoiceByEmail ? (
                  <Tooltip
                    title={!invoiceEmailTo ? 'Въведете имейл.....' : ''}
                    open={emailTooltipOpen}
                    arrow
                    placement="top"
                  >
                    <TextField
                      label="Имейл"
                      key={selectedOrder?.id || 'invoice-email'}
                      defaultValue={invoiceEmailTo}
                      onChange={(e) => setInvoiceEmailDebounced(e.target.value)}
                      fullWidth
                      size="small"
                      sx={{ mt: 1 }}
                      helperText="Ще се изпратят Протокол + Фактура като PDF прикачени файлове (име: Фактура(рег.номер)_дата.pdf и Протокол(рег.номер)_дата.pdf)."
                      disabled={reservingDocs || sendingInvoiceEmail}
                    />
                  </Tooltip>
                ) : null}
              </Box>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInvoiceConfirmOpen(false)}>Отказ</Button>
          <Button
            variant="contained"
            color="success"
            onClick={async () => {
              if (!selectedOrder) return;
              try {
                setReservingDocs(true);
                const doc = await reserveDocumentNumbers();
                setInvoicedDocsByOrderId((prev) => ({ ...prev, [doc.order_id]: doc }));
                setInvoiceConfirmOpen(false);
                openInvoicePrint(doc);
                // Defer heavy work (PDF render happens server-side) so the UI stays responsive.
                setTimeout(() => {
                  void sendInvoiceEmailForDoc(doc);
                }, 0);
              } catch (e) {
                alert(e?.response?.data?.error || 'Грешка при генериране на номера за протокол/фактура');
              } finally {
                setReservingDocs(false);
              }
            }}
            disabled={
              reservingDocs ||
              (!selectedVehicleType && !vehicleTypeOverride) ||
              (sendInvoiceByEmail && !String(invoiceEmailInputRef.current || invoiceEmailTo || '').trim()) ||
              missingFreeOps.length > 0 ||
              !String(invoiceIssueDateDraft || '').trim()
            }
          >
            {reservingDocs ? 'Генериране...' : 'Потвърди'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Worktime details */}
      <Dialog
        open={worktimeDetailsOpen}
        onClose={() => setWorktimeDetailsOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={fullScreenDialog}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StickyNote2Icon sx={{ color: selectedOrderWorktime?.notes ? 'warning.main' : 'action.disabled' }} />
            <Typography sx={{ fontWeight: 800 }}>{selectedOrderWorktime?.worktime_title}</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedOrderWorktime && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label={`Компонент: ${selectedOrderWorktime.component_type}`} size="small" />
                <Chip
                  label={`Категория: ${formatCategoryLabel(categoryVehicleType, selectedOrderWorktime.component_type)}`}
                  size="small"
                />
                {String(selectedOrderWorktime?.component_type || '').trim() === 'free_ops' ? (
                  <Chip label="Без нормовреме" size="small" />
                ) : (
                  <Chip label={`Време: ${selectedOrderWorktime.hours}ч`} size="small" />
                )}
                <Chip label={`Количество: x${selectedOrderWorktime.quantity}`} size="small" />
                <Chip
                  label={`Общо: ${(selectedOrderWorktime.hours * selectedOrderWorktime.quantity).toFixed(2).replace(/\.00$/, '')}ч`}
                  size="small"
                  color="primary"
                  sx={{ fontWeight: 800 }}
                />
                {String(selectedOrderWorktime?.component_type || '').trim() === 'free_ops' ? (
                  <Chip
                    label={(Number(selectedOrderWorktime?.unit_price_bgn) || 0) > 0
                      ? `Цена: ${(Number(selectedOrderWorktime?.unit_price_bgn) || 0).toFixed(2)} лв`
                      : 'Липсва цена'}
                    size="small"
                    color={(Number(selectedOrderWorktime?.unit_price_bgn) || 0) > 0 ? 'success' : 'error'}
                    variant={(Number(selectedOrderWorktime?.unit_price_bgn) || 0) > 0 ? 'outlined' : 'filled'}
                    sx={{ fontWeight: 900 }}
                  />
                ) : null}
              </Box>

              {String(selectedOrderWorktime?.component_type || '').trim() === 'free_ops' ? (
                <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 0.75 }}>
                    Цена за фактуриране (ед. цена)
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                    <TextField
                      label="Ед. цена (лв) *"
                      type="number"
                      size="small"
                      value={priceDraft}
                      onChange={(e) => setPriceDraft(e.target.value)}
                      inputProps={{ min: 0, step: '0.01' }}
                      sx={{ width: { xs: '100%', sm: 220 } }}
                      helperText='Задължително поле за „Свободни Операции“. Фактуриране няма да е възможно без цена.'
                      disabled={isSelectedOrderAlreadyInvoiced || savingPrice}
                    />
                    <Button
                      variant="contained"
                      onClick={saveFreeOpsPrice}
                      disabled={isSelectedOrderAlreadyInvoiced || savingPrice}
                    >
                      {savingPrice ? 'Запис...' : 'Запази цена'}
                    </Button>
                  </Stack>
                  {isSelectedOrderAlreadyInvoiced ? (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                      Поръчката вече е фактурирана – цената не може да се променя.
                    </Typography>
                  ) : null}
                </Paper>
              ) : null}

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  label="Количество"
                  type="number"
                  size="small"
                  value={quantityDraft}
                  onChange={(e) => setQuantityDraft(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  inputProps={{ min: 1 }}
                  sx={{ width: 160 }}
                />
                <Button variant="outlined" onClick={saveWorktimeQuantity} disabled={!selectedOrderWorktime}>
                  Запази количество
                </Button>
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
                  Бележки
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    borderColor: (theme) =>
                      selectedOrderWorktime.notes ? theme.palette.warning.main : theme.palette.divider,
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {selectedOrderWorktime.notes ? selectedOrderWorktime.notes : '—'}
                  </Typography>
                </Paper>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={openNotes} startIcon={<EditIcon />} disabled={!selectedOrderWorktime}>
            Редактирай бележки
          </Button>
          <Button
            onClick={() => removeOrderWorktime(selectedOrderWorktime?.id)}
            color="error"
            startIcon={<DeleteIcon />}
            disabled={!selectedOrderWorktime}
          >
            Премахни
          </Button>
          <Button onClick={() => setWorktimeDetailsOpen(false)}>Затвори</Button>
        </DialogActions>
      </Dialog>

      {/* Notes editor */}
      <Dialog open={notesDialogOpen} onClose={() => setNotesDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={fullScreenDialog}>
        <DialogTitle>Бележки</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={4}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotesDialogOpen(false)} disabled={savingNotes}>
            Отказ
          </Button>
          <Button onClick={saveNotes} variant="contained" disabled={savingNotes}>
            Запази
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add worktime dialog (corrections before invoicing) */}
      <Dialog open={addWorktimeDialogOpen} onClose={() => setAddWorktimeDialogOpen(false)} maxWidth="md" fullWidth fullScreen={fullScreenDialog}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddIcon /> Добави нормовреме
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
              Категория ({categoryVehicleType === 'trailer' ? 'Ремарке' : 'Автомобил'})
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: categoryVehicleType === 'trailer' ? 'repeat(5, 1fr)' : 'repeat(3, 1fr)',
                },
                gap: 1,
              }}
            >
              {getCategoriesForVehicleType(categoryVehicleType).map((cat) => {
                const selected = worktimeCategoryKey === cat.key;
                const count = availableWorktimes.filter(
                  (w) => getWorktimeCategoryKey(w, categoryVehicleType) === cat.key
                ).length;
                return (
                  <Button
                    key={cat.key}
                    variant={selected ? 'contained' : 'outlined'}
                    onClick={() => setWorktimeCategoryKey(cat.key)}
                    sx={{ justifyContent: 'space-between', textAlign: 'left', py: 1, px: 1.25, borderRadius: 2 }}
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

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2, mt: 1 }}>
            <TextField
              label="Търсене"
              value={worktimeSearch}
              onChange={(e) => setWorktimeSearch(e.target.value)}
              sx={{ flex: 1, minWidth: 260 }}
            />
            <TextField
              label="Количество"
              type="number"
              value={addWorktimeQuantity}
              onChange={(e) => setAddWorktimeQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              inputProps={{ min: 1 }}
              sx={{ width: 160 }}
            />
          </Box>

          <List dense sx={{ p: 0 }}>
            {availableWorktimes
              .filter((w) => {
                if (getWorktimeCategoryKey(w, categoryVehicleType) !== worktimeCategoryKey) return false;
                const q = normCi(worktimeSearch).trim();
                if (!q) return true;
                const catLabel = formatCategoryLabel(categoryVehicleType, w.component_type);
                return ciIncludes(`${w.title} ${w.component_type} ${catLabel}`, q);
              })
              .map((w, idx, arr) => (
                <div key={w.id}>
                  <ListItem
                    button
                    onClick={() => addWorktimeToOrder(w)}
                    sx={{
                      borderRadius: 2,
                      mb: 0.5,
                      border: (theme) => `1px solid ${theme.palette.divider}`,
                      '&:hover': { backgroundColor: 'action.hover' },
                    }}
                  >
                    <ListItemText
                      primary={w.title}
                      secondary={`Категория: ${formatCategoryLabel(categoryVehicleType, w.component_type)}`}
                    />
                    {String(w?.component_type || '').trim() === 'free_ops' ? (
                      <Chip label="Без нормовреме" size="small" variant="outlined" />
                    ) : (
                      <Chip label={`${w.hours}ч`} size="small" variant="outlined" />
                    )}
                  </ListItem>
                  {idx < arr.length - 1 && <Divider sx={{ my: 0.25 }} />}
                </div>
              ))}
            {availableWorktimes.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Няма налични нормовремена.
              </Typography>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddWorktimeDialogOpen(false)}>Затвори</Button>
        </DialogActions>
      </Dialog>

      {/* Mark invoice as paid */}
      <Dialog
        open={markPaidConfirmOpen}
        onClose={() => {
          if (markingPaid) return;
          setMarkPaidConfirmOpen(false);
          setMarkPaidOrder(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PaidIcon color="warning" />
          Потвърждение
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Да се отбележи ли като <strong>ПЛАТЕНА</strong> фактурата за поръчка{' '}
            <strong>{markPaidOrder?.reg_number || '—'}</strong>
            {invoicedDocsByOrderId?.[markPaidOrder?.id]?.invoice_no
              ? ` (№${invoicedDocsByOrderId[markPaidOrder.id].invoice_no})`
              : ''}
            ?
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            След потвърждение поръчката ще се премести в „Архив“ и няма да се вижда в „Текущи“.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setMarkPaidConfirmOpen(false);
              setMarkPaidOrder(null);
            }}
            disabled={markingPaid}
          >
            Отказ
          </Button>
          <Button variant="contained" color="warning" onClick={confirmMarkPaid} disabled={markingPaid}>
            {markingPaid ? 'Запис...' : 'Потвърди'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
