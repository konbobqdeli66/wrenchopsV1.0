import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';

import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import BuildIcon from '@mui/icons-material/Build';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import RvHookupIcon from '@mui/icons-material/RvHookup';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';

import { getApiBaseUrl } from '../api';

const normalize = (v) => String(v ?? '').trim();

const getTokenFromUrl = () => {
  try {
    const p = new URLSearchParams(window.location.search);
    return p.get('token') || '';
  } catch {
    return '';
  }
};

export default function ClientPortal() {
  const fullScreenDialog = useMediaQuery('(max-width:600px)');

  const token = useMemo(() => normalize(getTokenFromUrl()), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [client, setClient] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [tab, setTab] = useState('truck');

  const [editOpen, setEditOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [editDraft, setEditDraft] = useState({ reg_number: '', vin: '' });
  const [editSaving, setEditSaving] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState({ vehicle_type: 'truck', reg_number: '', vin: '' });
  const [addSaving, setAddSaving] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyVehicle, setHistoryVehicle] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadSession = async () => {
    if (!token) {
      setError('Липсва токен в линка.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${getApiBaseUrl()}/client-portal/session?token=${encodeURIComponent(token)}`);
      setClient(res.data?.client || null);
      setVehicles(Array.isArray(res.data?.vehicles) ? res.data.vehicles : []);
    } catch (e) {
      setClient(null);
      setVehicles([]);
      setError(e?.response?.data?.error || 'Грешка при зареждане на данните.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trucks = useMemo(() => vehicles.filter((v) => String(v?.vehicle_type) === 'truck'), [vehicles]);
  const trailers = useMemo(() => vehicles.filter((v) => String(v?.vehicle_type) === 'trailer'), [vehicles]);
  const visibleVehicles = tab === 'trailer' ? trailers : trucks;

  const historyCountLabel = (v) => {
    const n = Number(v?.history_count);
    const safe = Number.isFinite(n) ? n : 0;
    return `${safe} ${safe === 1 ? 'запис' : 'записа'}`;
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
    } catch {
      // ignore
    }
  };

  const openEdit = (v) => {
    setEditVehicle(v);
    setEditDraft({
      reg_number: normalize(v?.reg_number),
      vin: normalize(v?.vin),
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editVehicle?.id) return;
    const reg = normalize(editDraft.reg_number);
    const vin = normalize(editDraft.vin);
    if (!reg) {
      setError('Рег. № е задължително поле.');
      return;
    }
    setEditSaving(true);
    setError('');
    try {
      const res = await axios.put(
        `${getApiBaseUrl()}/client-portal/vehicles/${editVehicle.id}?token=${encodeURIComponent(token)}`,
        { reg_number: reg, vin }
      );
      const updated = res.data || null;
      setVehicles((prev) => (prev || []).map((x) => (x?.id === updated?.id ? { ...x, ...updated } : x)));
      setEditOpen(false);
      setEditVehicle(null);
    } catch (e) {
      setError(e?.response?.data?.error || 'Грешка при запис.');
    } finally {
      setEditSaving(false);
    }
  };

  const saveAdd = async () => {
    const reg = normalize(addDraft.reg_number);
    const vin = normalize(addDraft.vin);
    const vehicle_type = addDraft.vehicle_type === 'trailer' ? 'trailer' : 'truck';
    if (!reg) {
      setError('Рег. № е задължително поле.');
      return;
    }
    setAddSaving(true);
    setError('');
    try {
      const res = await axios.post(
        `${getApiBaseUrl()}/client-portal/vehicles?token=${encodeURIComponent(token)}`,
        { vehicle_type, reg_number: reg, vin }
      );
      const created = res.data || null;
      setVehicles((prev) => [created, ...(prev || [])]);
      setAddDraft({ vehicle_type: 'truck', reg_number: '', vin: '' });
      setAddOpen(false);
    } catch (e) {
      setError(e?.response?.data?.error || 'Грешка при добавяне.');
    } finally {
      setAddSaving(false);
    }
  };

  const openHistory = async (v) => {
    setHistoryVehicle(v);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await axios.get(
        `${getApiBaseUrl()}/client-portal/vehicles/${v.id}/history?token=${encodeURIComponent(token)}`
      );
      setHistoryRows(Array.isArray(res.data) ? res.data : []);
    } catch {
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            Клиентски портал
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {client?.name ? <>Клиент: <strong>{client.name}</strong></> : '—'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadSession} disabled={loading}>
            Обнови
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setAddDraft({ vehicle_type: tab === 'trailer' ? 'trailer' : 'truck', reg_number: '', vin: '' });
              setAddOpen(true);
            }}
            disabled={loading}
          >
            Добави
          </Button>
        </Stack>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Card>
        <CardContent>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ mb: 2 }}
          >
            <Tab value="truck" label={`Влекачи (${trucks.length})`} icon={<LocalShippingIcon />} iconPosition="start" />
            <Tab value="trailer" label={`Ремаркета (${trailers.length})`} icon={<RvHookupIcon />} iconPosition="start" />
          </Tabs>

          <Grid container spacing={2}>
            {visibleVehicles.map((v) => (
              <Grid item xs={12} md={6} key={v.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 900, overflowWrap: 'anywhere' }}>
                          {v.reg_number}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                          VIN: {v.vin || '—'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'start' }}>
                        <Chip label={`История: ${historyCountLabel(v)}`} size="small" variant="outlined" />
                      </Box>
                    </Box>

                    <Divider sx={{ my: 1.5 }} />

                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <Button size="small" variant="outlined" startIcon={<BuildIcon />} onClick={() => openHistory(v)}>
                        История
                      </Button>
                      <Button size="small" variant="contained" startIcon={<EditIcon />} onClick={() => openEdit(v)}>
                        Редакция
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}

            {visibleVehicles.length === 0 ? (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  Няма записи.
                </Typography>
              </Grid>
            ) : null}
          </Grid>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog
        open={editOpen}
        onClose={() => {
          if (editSaving) return;
          setEditOpen(false);
        }}
        fullScreen={fullScreenDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon /> Редакция на МПС
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Рег. №"
                value={editDraft.reg_number}
                onChange={(e) => setEditDraft((p) => ({ ...p, reg_number: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="VIN"
                value={editDraft.vin}
                onChange={(e) => setEditDraft((p) => ({ ...p, vin: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={editSaving}>
            Затвори
          </Button>
          <Button variant="contained" onClick={saveEdit} disabled={editSaving}>
            {editSaving ? 'Запис...' : 'Запази'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add dialog */}
      <Dialog
        open={addOpen}
        onClose={() => {
          if (addSaving) return;
          setAddOpen(false);
        }}
        fullScreen={fullScreenDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddIcon /> Добавяне на МПС
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Тип"
                value={addDraft.vehicle_type}
                onChange={(e) => setAddDraft((p) => ({ ...p, vehicle_type: e.target.value }))}
                SelectProps={{ native: true }}
              >
                <option value="truck">Влекач</option>
                <option value="trailer">Ремарке</option>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Рег. №"
                value={addDraft.reg_number}
                onChange={(e) => setAddDraft((p) => ({ ...p, reg_number: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="VIN"
                value={addDraft.vin}
                onChange={(e) => setAddDraft((p) => ({ ...p, vin: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} disabled={addSaving}>
            Отказ
          </Button>
          <Button variant="contained" onClick={saveAdd} disabled={addSaving}>
            {addSaving ? 'Запис...' : 'Добави'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* History dialog */}
      <Dialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        fullScreen={fullScreenDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BuildIcon /> История – {historyVehicle?.reg_number || '—'}
        </DialogTitle>
        <DialogContent>
          {historyLoading ? (
            <Typography variant="body2" color="text.secondary">
              Зареждане...
            </Typography>
          ) : historyRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Няма сервизна история.
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {historyRows.map((o) => (
                <Card key={o.id} variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 900 }}>
                        #{o.id}
                      </Typography>
                      <Chip label={String(o.status || '') === 'completed' ? 'Приключена' : 'Активна'} size="small" />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Дата: <strong>{String(o.service_date || o.completed_at || o.created_at || '').slice(0, 19)}</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                      <strong>Ремонт:</strong> {o.complaint || '—'}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<ContentCopyIcon />}
            onClick={() => copyToClipboard(window.location.href)}
          >
            Копирай линка
          </Button>
          <Button onClick={() => setHistoryOpen(false)} variant="contained">
            Затвори
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

