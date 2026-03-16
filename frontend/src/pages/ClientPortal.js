import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  Switch,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';

import { ThemeProvider, createTheme } from '@mui/material/styles';

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
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('client_portal_dark_mode');
      if (saved === '1') return true;
      if (saved === '0') return false;
      return prefersDarkMode;
    } catch {
      return prefersDarkMode;
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [client, setClient] = useState(null);
  const [vehicles, setVehicles] = useState([]);

  const [branding, setBranding] = useState(null);

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

  const theme = useMemo(() => {
    return createTheme({
      palette: {
        mode: darkMode ? 'dark' : 'light',
        primary: { main: '#1976d2' },
        secondary: { main: '#ff6b9d' },
        background: {
          default: darkMode ? '#0d0d0d' : '#ffffff',
          paper: darkMode ? '#1a1a1a' : '#ffffff',
        },
      },
      shape: { borderRadius: 14 },
      typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      },
      components: {
        MuiAppBar: {
          styleOverrides: {
            root: {
              background: `linear-gradient(90deg, ${darkMode ? '#000000' : '#ffffff'} 0%, #1976d2 55%, #ff6b9d 100%)`,
              color: darkMode ? '#ffffff' : '#000000',
            },
          },
        },
      },
    });
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem('client_portal_dark_mode', darkMode ? '1' : '0');
    } catch {
      // ignore
    }
  }, [darkMode]);

  useEffect(() => {
    // Branding is public (no login)
    fetch(`${getApiBaseUrl()}/public/branding`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setBranding(data);
      })
      .catch(() => null);
  }, []);

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
  const logoDataUrl = String(branding?.logo_data_url || '').trim();
  const brandName = String(branding?.app_brand_name || '').trim() || 'WrenchOps';

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
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" elevation={6}>
        <Toolbar sx={{ gap: 1, minHeight: 64 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            {logoDataUrl ? (
              <Box
                component="img"
                src={logoDataUrl}
                alt="logo"
                sx={{
                  height: 36,
                  width: 36,
                  objectFit: 'contain',
                  filter: darkMode ? 'invert(1)' : 'none',
                }}
              />
            ) : (
              <BuildIcon sx={{ fontSize: 28 }} />
            )}

            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {brandName}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  opacity: 0.92,
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: { xs: 220, sm: 420, md: 600 },
                }}
                title={client?.name || ''}
              >
                {client?.name ? `Клиент: ${client.name}` : 'Клиентски портал'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              {darkMode ? 'Тъмен' : 'Светъл'}
            </Typography>
            <Switch
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
              color="default"
              inputProps={{ 'aria-label': 'dark mode' }}
            />
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>
              Автомобили и ремаркета
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
              <Chip icon={<LocalShippingIcon />} label={`Влекачи: ${trucks.length}`} size="small" variant="outlined" />
              <Chip icon={<RvHookupIcon />} label={`Ремаркета: ${trailers.length}`} size="small" variant="outlined" />
            </Box>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadSession} disabled={loading}>
              Обнови
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setAddDraft({ vehicle_type: 'truck', reg_number: '', vin: '' });
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
            <Typography variant="h6" sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <LocalShippingIcon color="primary" /> Влекачи
            </Typography>
            <Grid container spacing={2}>
              {trucks.map((v) => (
                <Grid item xs={12} md={6} key={v.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 900, overflowWrap: 'anywhere' }}>{v.reg_number}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                            VIN: {v.vin || '—'}
                          </Typography>
                        </Box>
                        <Chip label={`История: ${historyCountLabel(v)}`} size="small" variant="outlined" />
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

              {trucks.length === 0 ? (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    Няма влекачи.
                  </Typography>
                </Grid>
              ) : null}
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <RvHookupIcon color="secondary" /> Ремаркета
            </Typography>
            <Grid container spacing={2}>
              {trailers.map((v) => (
                <Grid item xs={12} md={6} key={v.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 900, overflowWrap: 'anywhere' }}>{v.reg_number}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                            VIN: {v.vin || '—'}
                          </Typography>
                        </Box>
                        <Chip label={`История: ${historyCountLabel(v)}`} size="small" variant="outlined" />
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

              {trailers.length === 0 ? (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    Няма ремаркета.
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
    </ThemeProvider>
  );
}

