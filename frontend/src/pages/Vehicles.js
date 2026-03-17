import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Box,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useMediaQuery,
  Tooltip,
  Alert
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import BuildIcon from "@mui/icons-material/Build";
import PersonIcon from "@mui/icons-material/Person";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import RvHookupIcon from "@mui/icons-material/RvHookup";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { getApiBaseUrl } from "../api";
import { formatCategoryLabel } from "../utils/worktimeClassification";

export default function Vehicles({ t, setPage, userRole }) {
  const langCode = (typeof window !== 'undefined' && localStorage.getItem('language')) || 'bg';
  const locale = langCode === 'bg' ? 'bg-BG' : langCode === 'de' ? 'de-DE' : 'en-US';

  const isAdmin = String(userRole || '').trim() === 'admin';

  const [vehicles, setVehicles] = useState([]);
  const [searchParams, setSearchParams] = useState({
    q: '',
    reg_number: '',
    vin: '',
    brand: '',
    model: '',
    vehicle_type: ''
  });
  const [showDetailedSearch, setShowDetailedSearch] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [serviceHistory, setServiceHistory] = useState([]);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Admin: edit vehicle identity (reg_number + VIN)
  const [editVehicleDialogOpen, setEditVehicleDialogOpen] = useState(false);
  const [editVehicleSaving, setEditVehicleSaving] = useState(false);
  const [editVehicleTarget, setEditVehicleTarget] = useState(null);
  const [editVehicleDraft, setEditVehicleDraft] = useState({ reg_number: '', vin: '' });

  const [orderDetailsDialogOpen, setOrderDetailsDialogOpen] = useState(false);
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState(null);
  const [historyOrderWorktimes, setHistoryOrderWorktimes] = useState([]);
  const [historyOrderWorktimesLoading, setHistoryOrderWorktimesLoading] = useState(false);

  // Admin: add operation row (order_worktimes)
  const [availableWorktimes, setAvailableWorktimes] = useState([]);
  const [addOpDialogOpen, setAddOpDialogOpen] = useState(false);
  const [addOpSaving, setAddOpSaving] = useState(false);
  const [addOpDraft, setAddOpDraft] = useState({ worktime_id: '', quantity: 1, notes: '', unit_price_bgn: '' });
  const [addOpSearch, setAddOpSearch] = useState('');

  // Admin: add a NEW history entry (manual completed order)
  const [addHistoryEntryDialogOpen, setAddHistoryEntryDialogOpen] = useState(false);
  const [addHistoryEntrySaving, setAddHistoryEntrySaving] = useState(false);
  const [addHistoryEntryDraft, setAddHistoryEntryDraft] = useState({
    service_dt_local: '',
    odometer_km: '',
    complaint: '',
  });

  // Admin: edit history meta (service date + complaint)
  const [editHistoryOrderDialogOpen, setEditHistoryOrderDialogOpen] = useState(false);
  const [editHistoryOrderSaving, setEditHistoryOrderSaving] = useState(false);
  const [editHistoryOrderDraft, setEditHistoryOrderDraft] = useState({
    service_dt_local: '',
    odometer_km: '',
    complaint: '',
  });

  // Admin: edit operation row (order_worktimes)
  const [editOpDialogOpen, setEditOpDialogOpen] = useState(false);
  const [editOpSaving, setEditOpSaving] = useState(false);
  const [selectedOpRow, setSelectedOpRow] = useState(null);
  const [editOpDraft, setEditOpDraft] = useState({ quantity: 1, notes: '', unit_price_bgn: '' });

  const fullScreenDialog = useMediaQuery('(max-width:600px)');

  const getVehicleIcon = (vehicleType) => {
    return vehicleType === 'truck' ? LocalShippingIcon : RvHookupIcon;
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  async function loadVehicles() {
    const res = await axios.get(`${getApiBaseUrl()}/vehicles`);
    setVehicles(res.data);
  }

  async function searchVehicles() {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });

    const res = await axios.get(`${getApiBaseUrl()}/vehicles/search?${params}`);
    setVehicles(res.data);
  }

  async function loadServiceHistory(vehicleId) {
    const res = await axios.get(`${getApiBaseUrl()}/vehicles/${vehicleId}/history`);
    setServiceHistory(res.data);
    setHistoryDialogOpen(true);
  }

  const normalize = (v) => String(v ?? '').trim();

  const openEditVehicle = (vehicle) => {
    if (!isAdmin) return;
    if (!vehicle?.id) return;
    setEditVehicleTarget(vehicle);
    setEditVehicleDraft({
      reg_number: normalize(vehicle.reg_number),
      vin: normalize(vehicle.vin),
    });
    setEditVehicleDialogOpen(true);
  };

  const saveVehicleIdentity = async () => {
    if (!isAdmin) return;
    if (!editVehicleTarget?.id) return;

    const reg = normalize(editVehicleDraft.reg_number);
    const vin = normalize(editVehicleDraft.vin);
    if (!reg) {
      alert('Рег. № е задължително поле.');
      return;
    }

    try {
      setEditVehicleSaving(true);
      const res = await axios.put(`${getApiBaseUrl()}/vehicles/${editVehicleTarget.id}`, {
        reg_number: reg,
        vin,
      });

      const updated = res?.data || null;

      // Update list
      setVehicles((prev) =>
        (prev || []).map((v) => (Number(v?.id) === Number(updated?.id) ? { ...v, ...updated } : v))
      );

      // Update currently opened vehicle + refresh history (history is keyed by reg_number)
      if (selectedVehicle?.id && Number(selectedVehicle.id) === Number(updated?.id)) {
        setSelectedVehicle((prev) => ({ ...(prev || {}), ...(updated || {}) }));
        if (historyDialogOpen) {
          try {
            const h = await axios.get(`${getApiBaseUrl()}/vehicles/${updated.id}/history`);
            setServiceHistory(Array.isArray(h.data) ? h.data : []);
          } catch {
            // ignore
          }
        }
      }

      setEditVehicleDialogOpen(false);
      setEditVehicleTarget(null);
    } catch (e) {
      alert(e?.response?.data?.error || 'Грешка при запис на промяната.');
    } finally {
      setEditVehicleSaving(false);
    }
  };

  async function loadHistoryOrderWorktimes(orderId) {
    try {
      setHistoryOrderWorktimesLoading(true);
      const res = await axios.get(`${getApiBaseUrl()}/orders/${orderId}/worktimes`);
      setHistoryOrderWorktimes(Array.isArray(res.data) ? res.data : []);
    } catch {
      setHistoryOrderWorktimes([]);
    } finally {
      setHistoryOrderWorktimesLoading(false);
    }
  }

  async function loadAvailableWorktimes(vehicleTypeOverride = null) {
    try {
      const vt = vehicleTypeOverride || selectedVehicle?.vehicle_type || 'truck';
      const stdPromise = axios.get(`${getApiBaseUrl()}/worktimes?vehicle_type=${encodeURIComponent(vt)}`);
      const freePromise = axios.get(`${getApiBaseUrl()}/worktimes/free_ops?vehicle_type=${encodeURIComponent(vt)}`);
      const [stdRes, freeRes] = await Promise.allSettled([stdPromise, freePromise]);
      const std = stdRes.status === 'fulfilled' ? (Array.isArray(stdRes.value.data) ? stdRes.value.data : []) : [];
      const free = freeRes.status === 'fulfilled' ? (Array.isArray(freeRes.value.data) ? freeRes.value.data : []) : [];

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

  const getOrderServiceDtSqlite = (order) => {
    return (
      order?.service_date ||
      order?.completed_at ||
      order?.created_at ||
      ''
    );
  };

  const sqliteToLocalInput = (sqliteDt) => {
    // 'YYYY-MM-DD HH:MM:SS' -> 'YYYY-MM-DDTHH:MM'
    const s = String(sqliteDt || '').trim();
    if (!s) return '';
    const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?$/);
    if (!m) return '';
    return `${m[1]}T${m[2]}`;
  };

  const localInputToIso = (localDt) => {
    const s = String(localDt || '').trim();
    if (!s) return null;
    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return null;
    return d.toISOString();
  };

  const formatServiceDateForUi = (order) => {
    const dt = getOrderServiceDtSqlite(order);
    if (!dt) return '—';
    // Best-effort parse for SQLite-like strings.
    const d = new Date(String(dt).replace(' ', 'T') + 'Z');
    if (!Number.isFinite(d.getTime())) return String(dt);
    return d.toLocaleString(locale);
  };

  const openEditHistoryOrder = (order) => {
    if (!isAdmin) return;
    if (!order?.id) return;
    setSelectedHistoryOrder(order);
    setEditHistoryOrderDraft({
      service_dt_local: sqliteToLocalInput(getOrderServiceDtSqlite(order)),
      odometer_km: order?.odometer_km === null || order?.odometer_km === undefined ? '' : String(order?.odometer_km),
      complaint: String(order?.complaint || ''),
    });
    setEditHistoryOrderDialogOpen(true);
  };

  const openAddHistoryEntry = () => {
    if (!isAdmin) return;
    if (!selectedVehicle?.id) return;

    // Default: now
    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, '0');
    const local = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}T${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

    setAddHistoryEntryDraft({
      service_dt_local: local,
      odometer_km: '',
      complaint: '',
    });
    setAddHistoryEntryDialogOpen(true);
  };

  const saveNewHistoryEntry = async () => {
    if (!isAdmin) return;
    if (!selectedVehicle?.id) return;

    const iso = localInputToIso(addHistoryEntryDraft.service_dt_local);
    if (!iso) {
      alert('Моля изберете валидна дата и час.');
      return;
    }

    const odoRaw = String(addHistoryEntryDraft.odometer_km || '').trim();
    const odo = odoRaw ? Number(odoRaw.replace(',', '.')) : null;
    if (odo !== null && (!Number.isFinite(odo) || odo < 0)) {
      alert('Моля въведете валидни километри (>= 0).');
      return;
    }

    try {
      setAddHistoryEntrySaving(true);
      await axios.post(`${getApiBaseUrl()}/vehicles/${selectedVehicle.id}/history`, {
        service_date: iso,
        odometer_km: odo,
        complaint: addHistoryEntryDraft.complaint,
      });

      // Refresh history list
      const h = await axios.get(`${getApiBaseUrl()}/vehicles/${selectedVehicle.id}/history`);
      setServiceHistory(Array.isArray(h.data) ? h.data : []);
      setAddHistoryEntryDialogOpen(false);
    } catch (e) {
      alert(e?.response?.data?.error || 'Грешка при добавяне на запис в историята.');
    } finally {
      setAddHistoryEntrySaving(false);
    }
  };

  const saveHistoryOrderEdits = async () => {
    if (!isAdmin) return;
    if (!selectedHistoryOrder?.id) return;

    const iso = localInputToIso(editHistoryOrderDraft.service_dt_local);
    if (!iso) {
      alert('Моля изберете валидна дата и час.');
      return;
    }

    const odoRaw = String(editHistoryOrderDraft.odometer_km || '').trim();
    const odo = odoRaw ? Number(odoRaw.replace(',', '.')) : null;
    if (odo !== null && (!Number.isFinite(odo) || odo < 0)) {
      alert('Моля въведете валидни километри (>= 0).');
      return;
    }

    try {
      setEditHistoryOrderSaving(true);
      const isCompleted = String(selectedHistoryOrder?.status || '').trim() !== 'active';
      const payload = {
        complaint: editHistoryOrderDraft.complaint,
        odometer_km: odo,
        ...(isCompleted ? { completed_at: iso } : { created_at: iso }),
      };

      const res = await axios.put(`${getApiBaseUrl()}/orders/${selectedHistoryOrder.id}`, payload);
      const updated = res?.data || null;

      // Refresh list
      if (selectedVehicle?.id) {
        const h = await axios.get(`${getApiBaseUrl()}/vehicles/${selectedVehicle.id}/history`);
        setServiceHistory(Array.isArray(h.data) ? h.data : []);
      }

      if (updated?.id) {
        setSelectedHistoryOrder((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
      }

      setEditHistoryOrderDialogOpen(false);
    } catch (e) {
      alert(e?.response?.data?.error || 'Грешка при запис на корекциите.');
    } finally {
      setEditHistoryOrderSaving(false);
    }
  };

  const formatOdometerForUi = (order) => {
    const km = order?.odometer_km;
    if (km === null || km === undefined || km === '') return '—';
    const n = Number(km);
    if (!Number.isFinite(n)) return String(km);
    return n.toLocaleString(locale);
  };

  const openEditOp = (ow) => {
    if (!isAdmin) return;
    if (!ow?.id) return;
    setSelectedOpRow(ow);
    setEditOpDraft({
      quantity: Number(ow?.quantity) || 1,
      notes: String(ow?.notes || ''),
      unit_price_bgn:
        String(ow?.component_type || '').trim() === 'free_ops'
          ? String(Number(ow?.unit_price_bgn) || '')
          : '',
    });
    setEditOpDialogOpen(true);
  };

  const saveOpEdits = async () => {
    if (!isAdmin) return;
    if (!selectedHistoryOrder?.id || !selectedOpRow?.id) return;
    try {
      setEditOpSaving(true);
      const isFree = String(selectedOpRow?.component_type || '').trim() === 'free_ops';
      const payload = {
        quantity: Math.max(1, parseInt(editOpDraft.quantity, 10) || 1),
        notes: editOpDraft.notes,
        ...(isFree
          ? {
              unit_price_bgn: Number(String(editOpDraft.unit_price_bgn || '').replace(',', '.')),
            }
          : {}),
      };
      await axios.put(
        `${getApiBaseUrl()}/orders/${selectedHistoryOrder.id}/worktimes/${selectedOpRow.id}`,
        payload
      );
      await loadHistoryOrderWorktimes(selectedHistoryOrder.id);
      setEditOpDialogOpen(false);
      setSelectedOpRow(null);
    } catch (e) {
      alert(e?.response?.data?.error || 'Грешка при запис на операцията.');
    } finally {
      setEditOpSaving(false);
    }
  };

  const deleteOpRow = async (ow) => {
    if (!isAdmin) return;
    if (!selectedHistoryOrder?.id || !ow?.id) return;
    if (!window.confirm('Сигурни ли сте, че искате да изтриете тази операция?')) return;
    try {
      await axios.delete(`${getApiBaseUrl()}/orders/worktimes/${ow.id}`);
      await loadHistoryOrderWorktimes(selectedHistoryOrder.id);
    } catch (e) {
      alert(e?.response?.data?.error || 'Грешка при изтриване на операцията.');
    }
  };

  const openHistoryOrderDetails = async (order) => {
    setSelectedHistoryOrder(order);
    setOrderDetailsDialogOpen(true);
    await loadHistoryOrderWorktimes(order.id);

    if (isAdmin) {
      const vt = selectedVehicle?.vehicle_type === 'trailer' ? 'trailer' : 'truck';
      await loadAvailableWorktimes(vt);
    }
  };

  const openAddOperation = () => {
    if (!isAdmin) return;
    if (!selectedHistoryOrder?.id) return;
    setAddOpDraft({ worktime_id: '', quantity: 1, notes: '', unit_price_bgn: '' });
    setAddOpSearch('');
    setAddOpDialogOpen(true);
  };

  const saveAddedOperation = async () => {
    if (!isAdmin) return;
    if (!selectedHistoryOrder?.id) return;
    const worktimeId = Number(addOpDraft.worktime_id);
    if (!Number.isFinite(worktimeId) || worktimeId <= 0) {
      alert('Моля изберете операция (нормовреме).');
      return;
    }

    const wt = (availableWorktimes || []).find((w) => Number(w?.id) === worktimeId);
    const isFree = String(wt?.component_type || '').trim() === 'free_ops';

    const qty = Math.max(1, parseInt(addOpDraft.quantity, 10) || 1);

    let unitPricePayload = {};
    if (isFree) {
      const parsed = Number(String(addOpDraft.unit_price_bgn || '').replace(',', '.'));
      if (!Number.isFinite(parsed) || parsed < 0) {
        alert('Моля въведете валидна цена (>= 0 лв).');
        return;
      }
      unitPricePayload = { unit_price_bgn: parsed };
    }

    try {
      setAddOpSaving(true);
      await axios.post(`${getApiBaseUrl()}/orders/${selectedHistoryOrder.id}/worktimes`, {
        worktime_id: worktimeId,
        quantity: qty,
        notes: addOpDraft.notes,
        ...unitPricePayload,
      });
      await loadHistoryOrderWorktimes(selectedHistoryOrder.id);
      setAddOpDialogOpen(false);
    } catch (e) {
      alert(e?.response?.data?.error || 'Грешка при добавяне на операция.');
    } finally {
      setAddOpSaving(false);
    }
  };

  const filteredAvailableWorktimes = (availableWorktimes || []).filter((w) => {
    const q = String(addOpSearch || '').trim().toLowerCase();
    if (!q) return true;
    return String(w?.title || '').toLowerCase().includes(q);
  });

  const handleVehicleClick = (vehicle) => {
    setSelectedVehicle(vehicle);
    loadServiceHistory(vehicle.id);
  };

  const getHistoryCountLabel = (vehicle) => {
    const n = Number(vehicle?.history_count);
    const safe = Number.isFinite(n) ? n : 0;
    return `${safe} ${safe === 1 ? 'запис' : 'записа'}`;
  };

  const clearSearch = () => {
    setSearchParams({
      q: '',
      reg_number: '',
      vin: '',
      brand: '',
      model: '',
      vehicle_type: ''
    });
    loadVehicles();
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DirectionsCarIcon />
        {t('vehiclesTitle')}
      </Typography>

      {/* Search Filters */}
      <Card sx={{ mb: 4, p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t('vehiclesSearch')}
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label={t('generalSearch')}
              value={searchParams.q}
              onChange={(e) => setSearchParams({ ...searchParams, q: e.target.value })}
              placeholder={t('generalSearchPlaceholder')}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label={t('regNumber')}
              value={searchParams.reg_number}
              onChange={(e) => setSearchParams({ ...searchParams, reg_number: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label={t('vin')}
              value={searchParams.vin}
              onChange={(e) => setSearchParams({ ...searchParams, vin: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <IconButton
                color="primary"
                onClick={searchVehicles}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': { bgcolor: 'primary.dark' }
                }}
              >
                <SearchIcon />
              </IconButton>
              <IconButton
                color="secondary"
                onClick={clearSearch}
                sx={{
                  border: 1,
                  borderColor: 'secondary.main'
                }}
              >
                <ClearIcon />
              </IconButton>
              <Button
                variant="text"
                onClick={() => setShowDetailedSearch(!showDetailedSearch)}
                sx={{ ml: 'auto' }}
              >
                {showDetailedSearch ? t('hideDetailedSearch') : t('showDetailedSearch')}
              </Button>
            </Box>
          </Grid>
        </Grid>

        {/* Detailed Search */}
        {showDetailedSearch && (
          <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              {t('detailedSearch')}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  label={t('brand')}
                  value={searchParams.brand}
                  onChange={(e) => setSearchParams({ ...searchParams, brand: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  label={t('model')}
                  value={searchParams.model}
                  onChange={(e) => setSearchParams({ ...searchParams, model: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth sx={{ minWidth: 200 }}>
                  <InputLabel>{t('vehicleType')}</InputLabel>
                  <Select
                    value={searchParams.vehicle_type}
                    onChange={(e) => setSearchParams({ ...searchParams, vehicle_type: e.target.value })}
                    label={t('vehicleType')}
                  >
                    <MenuItem value="">{t('all')}</MenuItem>
                    <MenuItem value="truck">{t('truck')}</MenuItem>
                    <MenuItem value="trailer">{t('trailer')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        )}
      </Card>

      {/* Vehicles Table */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              {t('results')} ({vehicles.length})
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {t('showItems')}
              </Typography>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <Select
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
          {/* Desktop Table View */}
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>{t('vehicle')}</strong></TableCell>
                    <TableCell><strong>{t('regNumberShort')}</strong></TableCell>
                    <TableCell><strong>{t('vin')}</strong></TableCell>
                    <TableCell><strong>{t('owner')}</strong></TableCell>
                    <TableCell><strong>{t('actions')}</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vehicles.slice(0, itemsPerPage).map((vehicle) => (
                    <TableRow
                      key={vehicle.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleVehicleClick(vehicle)}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {React.createElement(getVehicleIcon(vehicle.vehicle_type), {
                            color: vehicle.vehicle_type === 'truck' ? 'primary' : 'secondary'
                          })}
                          <Box>
                            <Typography variant="body1" fontWeight="bold">
                              {vehicle.brand} {vehicle.model}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {vehicle.vehicle_type === 'truck' ? t('truck') : t('trailer')} • {vehicle.year || t('none')}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={vehicle.reg_number} variant="outlined" />
                      </TableCell>
                      <TableCell>{vehicle.vin || '-'}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PersonIcon color="action" />
                          {vehicle.client_name}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {isAdmin ? (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<EditIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditVehicle(vehicle);
                              }}
                            >
                              Редакция
                            </Button>
                          ) : null}
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<BuildIcon />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVehicleClick(vehicle);
                            }}
                          >
                            {t('history')} ({getHistoryCountLabel(vehicle)})
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {vehicles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        {t('noVehiclesFound')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* Mobile Card View */}
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            <Grid container spacing={2}>
              {vehicles.slice(0, itemsPerPage).map((vehicle) => {
                const IconComponent = getVehicleIcon(vehicle.vehicle_type);
                return (
                  <Grid item xs={12} key={vehicle.id}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { boxShadow: 3 }
                      }}
                      onClick={() => handleVehicleClick(vehicle)}
                    >
                      <CardContent sx={{ pb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <IconComponent
                            color={vehicle.vehicle_type === 'truck' ? 'primary' : 'secondary'}
                            sx={{ fontSize: 24 }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" fontWeight="bold">
                              {vehicle.brand} {vehicle.model}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {vehicle.vehicle_type === 'truck' ? t('truck') : t('trailer')} • {vehicle.year || t('none')}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary">{t('regNumberShort')}:</Typography>
                            <Chip label={vehicle.reg_number} variant="outlined" size="small" />
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary">{t('vin')}:</Typography>
                            <Typography variant="body2">{vehicle.vin || t('none')}</Typography>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PersonIcon color="action" sx={{ fontSize: 16 }} />
                            <Typography variant="body2">{vehicle.client_name}</Typography>
                          </Box>
                        </Box>

                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {isAdmin ? (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<EditIcon />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditVehicle(vehicle);
                                }}
                              >
                                Редакция
                              </Button>
                            ) : null}
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<BuildIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVehicleClick(vehicle);
                              }}
                            >
                              {t('history')} ({getHistoryCountLabel(vehicle)})
                            </Button>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
              {vehicles.length === 0 && (
                <Grid item xs={12}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        {t('noVehiclesFound')}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* Service History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={fullScreenDialog}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BuildIcon />
          {t('serviceHistory')} - {selectedVehicle?.reg_number}
        </DialogTitle>
        <DialogContent>
          {selectedVehicle && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                {selectedVehicle.brand} {selectedVehicle.model}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('owner')}: {selectedVehicle.client_name} | {t('vin')}: {selectedVehicle.vin || t('none')}
              </Typography>
            </Box>
          )}

          {serviceHistory.length > 0 ? (
            <Box>
              {serviceHistory.map((order, index) => (
                <Accordion key={order.id} defaultExpanded={index === 0}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      <BuildIcon color="primary" />
                      <Typography variant="subtitle1">
                        {formatServiceDateForUi(order)}
                      </Typography>
                      <Chip
                        label={order.status === 'active' ? t('statusActive') : t('statusCompleted')}
                        color={order.status === 'active' ? 'primary' : 'default'}
                        size="small"
                      />
                      <Chip
                        label={`Км: ${formatOdometerForUi(order)}`}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 800 }}
                      />
                      {order.status !== 'active' && (
                        <Chip
                          label={t('details')}
                          color="success"
                          size="small"
                          variant="outlined"
                          sx={{ ml: 'auto', fontWeight: 800 }}
                        />
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      <strong>Оплакване:</strong> {order.complaint}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {t('odometer') || 'Километри'}: <strong>{formatOdometerForUi(order)} км</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('client')}: {order.client_name}
                    </Typography>

                    {isAdmin ? (
                      <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<EditIcon />}
                          onClick={() => openEditHistoryOrder(order)}
                        >
                          Редактирай история
                        </Button>
                      </Box>
                    ) : null}

                    {order.status !== 'active' && (
                      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<BuildIcon />}
                          onClick={() => openHistoryOrderDetails(order)}
                        >
                          {t('repairDetailsOps')}
                        </Button>
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          ) : (
            <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>
              {t('noServiceHistory')}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          {isAdmin ? (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mr: 'auto' }}>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => {
                  if (selectedVehicle) openEditVehicle(selectedVehicle);
                }}
              >
                Редактирай МПС
              </Button>
              <Button variant="outlined" onClick={openAddHistoryEntry} startIcon={<BuildIcon />}>
                Добави запис
              </Button>
            </Box>
          ) : null}
          <Button onClick={() => setHistoryDialogOpen(false)}>{t('close')}</Button>
        </DialogActions>
      </Dialog>

      {/* Admin: edit vehicle reg/VIN */}
      <Dialog
        open={editVehicleDialogOpen}
        onClose={() => {
          if (editVehicleSaving) return;
          setEditVehicleDialogOpen(false);
          setEditVehicleTarget(null);
        }}
        maxWidth="sm"
        fullWidth
        fullScreen={fullScreenDialog}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon />
          Редакция на превозно средство
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Собственик: <strong>{editVehicleTarget?.client_name || '—'}</strong>
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Рег. №"
                value={editVehicleDraft.reg_number}
                onChange={(e) => setEditVehicleDraft((p) => ({ ...p, reg_number: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="VIN"
                value={editVehicleDraft.vin}
                onChange={(e) => setEditVehicleDraft((p) => ({ ...p, vin: e.target.value }))}
              />
            </Grid>
          </Grid>
          <Alert severity="info" sx={{ mt: 2 }}>
            При промяна на Рег. № системата ще синхронизира и сервизната история за този клиент (поръчките ще бъдат прехвърлени към новия номер).
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditVehicleDialogOpen(false);
              setEditVehicleTarget(null);
            }}
            disabled={editVehicleSaving}
          >
            {t('cancel')}
          </Button>
          <Button variant="contained" onClick={saveVehicleIdentity} disabled={editVehicleSaving}>
            {editVehicleSaving ? t('saving') : t('save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Admin: add NEW history entry */}
      <Dialog
        open={addHistoryEntryDialogOpen}
        onClose={() => {
          if (addHistoryEntrySaving) return;
          setAddHistoryEntryDialogOpen(false);
        }}
        maxWidth="sm"
        fullWidth
        fullScreen={fullScreenDialog}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BuildIcon />
          Нов запис в сервизна история
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Автомобил: <strong>{selectedVehicle?.reg_number}</strong>
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Дата/час на ремонт"
                type="datetime-local"
                value={addHistoryEntryDraft.service_dt_local}
                onChange={(e) =>
                  setAddHistoryEntryDraft((prev) => ({ ...prev, service_dt_local: e.target.value }))
                }
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Километри (км)"
                type="number"
                inputProps={{ min: 0, step: 1 }}
                value={addHistoryEntryDraft.odometer_km}
                onChange={(e) =>
                  setAddHistoryEntryDraft((prev) => ({ ...prev, odometer_km: e.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Какво е правено / ремонт"
                value={addHistoryEntryDraft.complaint}
                onChange={(e) =>
                  setAddHistoryEntryDraft((prev) => ({ ...prev, complaint: e.target.value }))
                }
                multiline
                minRows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddHistoryEntryDialogOpen(false)} disabled={addHistoryEntrySaving}>
            {t('cancel')}
          </Button>
          <Button variant="contained" onClick={saveNewHistoryEntry} disabled={addHistoryEntrySaving}>
            {addHistoryEntrySaving ? t('saving') : 'Добави'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Completed repair details (operations/worktimes) */}
      <Dialog
        open={orderDetailsDialogOpen}
        onClose={() => {
          setOrderDetailsDialogOpen(false);
          setSelectedHistoryOrder(null);
          setHistoryOrderWorktimes([]);
        }}
        maxWidth="lg"
        fullWidth
        fullScreen={fullScreenDialog}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BuildIcon />
          {t('repairDetails')} – #{selectedHistoryOrder?.id} ({selectedHistoryOrder?.reg_number})
        </DialogTitle>
        <DialogContent>
          {selectedHistoryOrder && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {t('client')}: <strong>{selectedHistoryOrder.client_name}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('date')}: <strong>{formatServiceDateForUi(selectedHistoryOrder)}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('odometer') || 'Километри'}: <strong>{formatOdometerForUi(selectedHistoryOrder)} км</strong>
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>{t('complaintLabel')}:</strong> {selectedHistoryOrder.complaint}
              </Typography>

              {isAdmin ? (
                <Box sx={{ mt: 1.25, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => openEditHistoryOrder(selectedHistoryOrder)}
                  >
                    Редактирай
                  </Button>
                </Box>
              ) : null}
            </Box>
          )}

          {historyOrderWorktimesLoading ? (
            <Typography variant="body2" color="text.secondary">
              {t('loadingOperations')}
            </Typography>
          ) : historyOrderWorktimes.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('noOperations')}
            </Typography>
          ) : (
            <>
              {/* Mobile: cards/list */}
              <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                <Grid container spacing={2}>
                  {historyOrderWorktimes.map((ow) => {
                    const hours = Number(ow?.hours) || 0;
                    const qty = Number(ow?.quantity) || 0;
                    const total = hours * qty;
                    const vt = selectedVehicle?.vehicle_type === 'trailer' ? 'trailer' : 'truck';
                    return (
                      <Grid item xs={12} key={ow.id}>
                        <Card variant="outlined">
                          <CardContent sx={{ pb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'start' }}>
                              <Typography sx={{ fontWeight: 900 }}>{ow.worktime_title}</Typography>
                              <Chip
                                label={`${total.toFixed(2).replace(/\.00$/, '')}${t('hoursShortSuffix')}`}
                                size="small"
                                color="primary"
                                sx={{ fontWeight: 800 }}
                              />
                            </Box>
                            <Box sx={{ mt: 1, display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                              <Chip label={formatCategoryLabel(vt, ow.component_type)} size="small" variant="outlined" />
                              <Chip label={`${hours.toFixed(2).replace(/\.00$/, '')}${t('hoursShortSuffix')}`} size="small" variant="outlined" />
                              <Chip label={`${t('quantityShort')}: ${qty}`} size="small" variant="outlined" />
                            </Box>
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                                {t('notes')}
                              </Typography>
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                {ow.notes || '—'}
                              </Typography>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>

              {/* Desktop: table */}
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>{t('operation')}</strong></TableCell>
                        <TableCell><strong>{t('component')}</strong></TableCell>
                        <TableCell align="right"><strong>{t('hoursLabel')}</strong></TableCell>
                        <TableCell align="right"><strong>{t('quantityShort')}</strong></TableCell>
                        <TableCell align="right"><strong>{t('total')}</strong></TableCell>
                        <TableCell><strong>{t('notes')}</strong></TableCell>
                        {isAdmin ? <TableCell align="right"><strong>{t('actions')}</strong></TableCell> : null}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {historyOrderWorktimes.map((ow) => {
                        const hours = Number(ow?.hours) || 0;
                        const qty = Number(ow?.quantity) || 0;
                        const total = hours * qty;
                        const vt = selectedVehicle?.vehicle_type === 'trailer' ? 'trailer' : 'truck';
                        return (
                          <TableRow key={ow.id} hover>
                            <TableCell sx={{ fontWeight: 700 }}>{ow.worktime_title}</TableCell>
                            <TableCell>{formatCategoryLabel(vt, ow.component_type)}</TableCell>
                            <TableCell align="right">{hours.toFixed(2).replace(/\.00$/, '')}</TableCell>
                            <TableCell align="right">{qty}</TableCell>
                            <TableCell align="right">{total.toFixed(2).replace(/\.00$/, '')}</TableCell>
                            <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{ow.notes || '—'}</TableCell>
                            {isAdmin ? (
                              <TableCell align="right">
                                <Tooltip title="Редакция">
                                  <IconButton size="small" onClick={() => openEditOp(ow)}>
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Изтрий">
                                  <IconButton size="small" color="error" onClick={() => deleteOpRow(ow)}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            ) : null}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          {isAdmin ? (
            <Button variant="outlined" onClick={openAddOperation} startIcon={<BuildIcon />}>
              Добави операция
            </Button>
          ) : null}
          <Button
            onClick={() => {
              setOrderDetailsDialogOpen(false);
              setSelectedHistoryOrder(null);
              setHistoryOrderWorktimes([]);
            }}
          >
            {t('close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Admin: add operation (order_worktimes row) */}
      <Dialog
        open={addOpDialogOpen}
        onClose={() => {
          if (addOpSaving) return;
          setAddOpDialogOpen(false);
        }}
        maxWidth="md"
        fullWidth
        fullScreen={fullScreenDialog}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BuildIcon />
          Добавяне на операция
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Търси операция"
                value={addOpSearch}
                onChange={(e) => setAddOpSearch(e.target.value)}
                placeholder="Пример: Смяна на масло"
              />
            </Grid>
            <Grid item xs={12}>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Операция</strong></TableCell>
                      <TableCell><strong>Компонент</strong></TableCell>
                      <TableCell align="right"><strong>Часове</strong></TableCell>
                      <TableCell align="right"><strong>Избери</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredAvailableWorktimes.slice(0, 100).map((w) => {
                      const selected = String(addOpDraft.worktime_id) === String(w.id);
                      return (
                        <TableRow key={w.id} hover selected={selected}>
                          <TableCell sx={{ fontWeight: 800 }}>{w.title}</TableCell>
                          <TableCell>{String(w.component_type || '')}</TableCell>
                          <TableCell align="right">{Number(w.hours || 0).toFixed(2).replace(/\.00$/, '')}</TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant={selected ? 'contained' : 'outlined'}
                              onClick={() => setAddOpDraft((prev) => ({ ...prev, worktime_id: String(w.id) }))}
                            >
                              {selected ? 'Избрано' : 'Избери'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredAvailableWorktimes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          Няма намерени операции.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label={t('quantityShort')}
                type="number"
                inputProps={{ min: 1, step: 1 }}
                value={addOpDraft.quantity}
                onChange={(e) => setAddOpDraft((prev) => ({ ...prev, quantity: e.target.value }))}
              />
            </Grid>

            {(() => {
              const wt = (availableWorktimes || []).find((w) => String(w?.id) === String(addOpDraft.worktime_id));
              const isFree = String(wt?.component_type || '').trim() === 'free_ops';
              if (!isFree) return null;
              return (
                <Grid item xs={12} sm={8}>
                  <TextField
                    fullWidth
                    label="Ед. цена (лв)"
                    type="number"
                    inputProps={{ min: 0, step: '0.01' }}
                    value={addOpDraft.unit_price_bgn}
                    onChange={(e) => setAddOpDraft((prev) => ({ ...prev, unit_price_bgn: e.target.value }))}
                  />
                </Grid>
              );
            })()}

            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('notes')}
                multiline
                minRows={3}
                value={addOpDraft.notes}
                onChange={(e) => setAddOpDraft((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpDialogOpen(false)} disabled={addOpSaving}>
            {t('cancel')}
          </Button>
          <Button variant="contained" onClick={saveAddedOperation} disabled={addOpSaving}>
            {addOpSaving ? t('saving') : 'Добави'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Admin: edit history order (date + complaint) */}
      <Dialog
        open={editHistoryOrderDialogOpen}
        onClose={() => {
          if (editHistoryOrderSaving) return;
          setEditHistoryOrderDialogOpen(false);
        }}
        maxWidth="sm"
        fullWidth
        fullScreen={fullScreenDialog}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon />
          Ръчна корекция на сервизна история
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Поръчка: <strong>#{selectedHistoryOrder?.id}</strong> • {selectedHistoryOrder?.reg_number}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Дата/час на ремонт"
                type="datetime-local"
                value={editHistoryOrderDraft.service_dt_local}
                onChange={(e) =>
                  setEditHistoryOrderDraft((prev) => ({ ...prev, service_dt_local: e.target.value }))
                }
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Километри (км)"
                type="number"
                inputProps={{ min: 0, step: 1 }}
                value={editHistoryOrderDraft.odometer_km}
                onChange={(e) =>
                  setEditHistoryOrderDraft((prev) => ({ ...prev, odometer_km: e.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Какво е правено / оплакване"
                value={editHistoryOrderDraft.complaint}
                onChange={(e) =>
                  setEditHistoryOrderDraft((prev) => ({ ...prev, complaint: e.target.value }))
                }
                multiline
                minRows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditHistoryOrderDialogOpen(false)} disabled={editHistoryOrderSaving}>
            {t('cancel')}
          </Button>
          <Button variant="contained" onClick={saveHistoryOrderEdits} disabled={editHistoryOrderSaving}>
            {editHistoryOrderSaving ? t('saving') : t('save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Admin: edit operation row */}
      <Dialog
        open={editOpDialogOpen}
        onClose={() => {
          if (editOpSaving) return;
          setEditOpDialogOpen(false);
          setSelectedOpRow(null);
        }}
        maxWidth="sm"
        fullWidth
        fullScreen={fullScreenDialog}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon />
          Редакция на операция
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {selectedOpRow?.worktime_title}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label={t('quantityShort')}
                type="number"
                inputProps={{ min: 1, step: 1 }}
                value={editOpDraft.quantity}
                onChange={(e) => setEditOpDraft((prev) => ({ ...prev, quantity: e.target.value }))}
              />
            </Grid>
            {String(selectedOpRow?.component_type || '').trim() === 'free_ops' ? (
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="Ед. цена (лв)"
                  type="number"
                  inputProps={{ min: 0, step: '0.01' }}
                  value={editOpDraft.unit_price_bgn}
                  onChange={(e) =>
                    setEditOpDraft((prev) => ({ ...prev, unit_price_bgn: e.target.value }))
                  }
                />
              </Grid>
            ) : null}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('notes')}
                multiline
                minRows={3}
                value={editOpDraft.notes}
                onChange={(e) => setEditOpDraft((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditOpDialogOpen(false);
              setSelectedOpRow(null);
            }}
            disabled={editOpSaving}
          >
            {t('cancel')}
          </Button>
          <Button variant="contained" onClick={saveOpEdits} disabled={editOpSaving}>
            {editOpSaving ? t('saving') : t('save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
