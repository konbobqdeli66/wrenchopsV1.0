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

import { getApiBaseUrl } from '../api';
import { decodeJwtPayload } from '../utils/jwt';
import {
  formatCategoryLabel,
  getCategoriesForVehicleType,
  getWorktimeCategoryKey,
} from '../utils/worktimeClassification';

export default function Invoices() {
  const fullScreenDialog = useMediaQuery('(max-width:600px)');
  const isPhone = fullScreenDialog;
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

  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const [invoiceConfirmOpen, setInvoiceConfirmOpen] = useState(false);
  const [reservingDocs, setReservingDocs] = useState(false);

  // Optional: send invoice by email on invoicing
  const [sendInvoiceByEmail, setSendInvoiceByEmail] = useState(false);
  const [invoiceEmailTo, setInvoiceEmailTo] = useState('');
  const [sendingInvoiceEmail, setSendingInvoiceEmail] = useState(false);
  const [emailTooltipOpen, setEmailTooltipOpen] = useState(false);

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
      const res = await axios.get(`${getApiBaseUrl()}/worktimes`);
      setAvailableWorktimes(res.data);
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
    const q = search.trim().toLowerCase();
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
          `${o.reg_number} ${o.client_name} ${o.complaint}`.toLowerCase().includes(q)
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

    return sorted;
  }, [baseOrders, search, monthKey, sortMode, invoicedDocsByOrderId]);

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
    if (availableWorktimes.length === 0) {
      await loadAvailableWorktimes();
    }
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
    setWorktimeDetailsOpen(true);
  };

  const formatSqliteDateTime = (dt) => {
    if (!dt) return '—';
    // SQLite datetime('now') returns 'YYYY-MM-DD HH:MM:SS'
    const safe = String(dt).replace(' ', 'T');
    const d = new Date(safe);
    return Number.isNaN(d.getTime()) ? String(dt) : d.toLocaleString('bg-BG');
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
    const res = await axios.post(`${getApiBaseUrl()}/orders/${selectedOrder.id}/documents/reserve`);
    return res.data;
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

  const openInvoicePrint = (docNumbers) => {
    if (!selectedOrder) return;
    const totalHours = orderWorktimes.reduce(
      (sum, ow) => sum + (Number(ow.hours) || 0) * (Number(ow.quantity) || 0),
      0
    );
    const hourlyRate = Number(company.hourly_rate) || 100;
    const vatRate = Number(company.vat_rate) || 20;
    const taxBase = totalHours * hourlyRate;
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

    const logoDataUrl = company.logo_data_url || '';
    const logoHtml = logoDataUrl
      ? `<img src="${escapeHtml(logoDataUrl)}" style="max-width:110px; max-height:110px; object-fit:contain;" />`
      : '';

    const protocolRowHtmlItems = orderWorktimes.map((ow, idx) => {
        const hours = Number(ow.hours) || 0;
        const qty = Number(ow.quantity) || 0;
        const total = hours * qty;
        const notes = ow.notes ? escapeHtml(ow.notes) : '';
        return `
          <tr>
            <td style="text-align:center">${idx + 1}</td>
            <td>${escapeHtml(ow.worktime_title)}</td>
            <td class="notes">${notes}</td>
            <td style="text-align:right">${hours.toFixed(2).replace(/\.00$/, '')}</td>
            <td style="text-align:right">${qty}</td>
            <td style="text-align:right">${total.toFixed(2).replace(/\.00$/, '')}</td>
          </tr>
        `;
      });

    const effectiveType = vehicleTypeOverride || selectedVehicleType;
    const assetLabel =
      effectiveType === 'trailer' ? 'ремарке' : effectiveType === 'truck' ? 'автомобил' : 'превозно средство';

    const serviceDescription = `Ремонт на ${assetLabel} с регистрационен номер ${selectedOrder.reg_number} съгласно работна карта: ${protocolNo}`;

    // Invoice shows a single summarized row (totals are calculated from the worktimes above).
    const invoiceRowsHtml = `
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
              <div class="line"><span class="k">Дата на издаване:</span><span class="v">${escapeHtml(formatSqliteDateTime(completedAt))}</span></div>
              <div class="line"><span class="k">Дата на дан. събитие:</span><span class="v">${escapeHtml(formatSqliteDateTime(completedAt))}</span></div>
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
              <div class="line"><span><strong>Общо часове:</strong></span><span><strong>${totalHours.toFixed(2).replace(/\.00$/, '')} ч.</strong></span></div>
              <div class="line"><span><strong>Цена на час:</strong></span><span><strong>${fmtBgnEur(hourlyRate)}</strong></span></div>
              <div class="line"><span><strong>Общо без ДДС:</strong></span><span><strong>${fmtBgnEur(taxBase)}</strong></span></div>
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
            <div><span class="k">Дата на издаване:</span> <strong>${escapeHtml(formatSqliteDateTime(completedAt))}</strong></div>
            <div><span class="k">Дата на дан. събитие:</span> <strong>${escapeHtml(formatSqliteDateTime(completedAt))}</strong></div>
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
                  <td colspan="6" style="text-align:right; font-weight:700;">Данъчна основа (${vatRate.toFixed(2)} %):</td>
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
      .toolbar { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #ddd; padding: 10px 0; margin-bottom: 10px; }
      .toolbar button { padding: 8px 12px; font-size: 14px; }
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
        .toolbar { display: none; }
        body { margin: 0; }
      }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <button onclick="window.print()">Принтирай (4 страници)</button>
    </div>

    ${pagesHtml}

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
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => iframe.remove(), 1000);
      };
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
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

      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant={isPhone ? 'subtitle1' : 'h6'} sx={{ fontWeight: 900 }}>
          Приключени поръчки
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Показани: <strong>{filteredOrders.length}</strong>
        </Typography>
      </Box>

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
                                  <Chip label={`${ow.hours}ч`} size="small" variant="outlined" />
                                  <Chip label={`x${ow.quantity}`} size="small" variant="outlined" />
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
                Цена на час: <strong>{Number(company.hourly_rate) || 100} лв/ч</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ДДС: <strong>{Number(company.vat_rate) || 20}%</strong>
              </Typography>
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
              } catch {
                alert('Грешка при генериране на номера за протокол/фактура');
              } finally {
                setReservingDocs(false);
              }
            }}
            disabled={
              reservingDocs ||
              (!selectedVehicleType && !vehicleTypeOverride) ||
              (sendInvoiceByEmail && !String(invoiceEmailInputRef.current || invoiceEmailTo || '').trim())
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
                <Chip label={`Време: ${selectedOrderWorktime.hours}ч`} size="small" />
                <Chip label={`Количество: x${selectedOrderWorktime.quantity}`} size="small" />
                <Chip
                  label={`Общо: ${(selectedOrderWorktime.hours * selectedOrderWorktime.quantity).toFixed(2).replace(/\.00$/, '')}ч`}
                  size="small"
                  color="primary"
                  sx={{ fontWeight: 800 }}
                />
              </Box>

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
                const q = worktimeSearch.trim().toLowerCase();
                if (!q) return true;
                const catLabel = formatCategoryLabel(categoryVehicleType, w.component_type);
                return `${w.title} ${w.component_type} ${catLabel}`.toLowerCase().includes(q);
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
                    <Chip label={`${w.hours}ч`} size="small" variant="outlined" />
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

