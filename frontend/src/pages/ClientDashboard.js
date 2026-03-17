import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Box,
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
  Button,
  Typography,
  useMediaQuery,
} from '@mui/material';

import RefreshIcon from '@mui/icons-material/Refresh';
import BuildIcon from '@mui/icons-material/Build';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import RvHookupIcon from '@mui/icons-material/RvHookup';

import { getApiBaseUrl } from '../api';

export default function ClientDashboard() {
  const fullScreenDialog = useMediaQuery('(max-width:600px)');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [client, setClient] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [tab, setTab] = useState('truck');

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyVehicle, setHistoryVehicle] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadSession = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${getApiBaseUrl()}/client/session`);
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
  }, []);

  const trucks = useMemo(() => vehicles.filter((v) => String(v?.vehicle_type) === 'truck'), [vehicles]);
  const trailers = useMemo(() => vehicles.filter((v) => String(v?.vehicle_type) === 'trailer'), [vehicles]);
  const visibleVehicles = tab === 'trailer' ? trailers : trucks;

  const historyCountLabel = (v) => {
    const n = Number(v?.history_count);
    const safe = Number.isFinite(n) ? n : 0;
    return `${safe} ${safe === 1 ? 'запис' : 'записа'}`;
  };

  const openHistory = async (v) => {
    setHistoryVehicle(v);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${getApiBaseUrl()}/client/vehicles/${v.id}/history`);
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
            Клиентски профил
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {client?.name ? (
              <>
                Клиент: <strong>{client.name}</strong>
              </>
            ) : (
              '—'
            )}
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadSession} disabled={loading}>
          Обнови
        </Button>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Card>
        <CardContent>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
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
                        <Typography sx={{ fontWeight: 900, overflowWrap: 'anywhere' }}>{v.reg_number}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                          VIN: {v.vin || '—'}
                        </Typography>
                      </Box>
                      <Chip label={`История: ${historyCountLabel(v)}`} size="small" variant="outlined" />
                    </Box>

                    <Divider sx={{ my: 1.5 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button size="small" variant="contained" startIcon={<BuildIcon />} onClick={() => openHistory(v)}>
                        История
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
                      <Typography sx={{ fontWeight: 900 }}>#{o.id}</Typography>
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
          <Button onClick={() => setHistoryOpen(false)} variant="contained">
            Затвори
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

