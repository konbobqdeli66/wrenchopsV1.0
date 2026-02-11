import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Divider,
  Box,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ScheduleIcon from "@mui/icons-material/Schedule";
import PaidIcon from "@mui/icons-material/Paid";
import { getApiBaseUrl } from "../api";

const toBgDate = (sqliteDt) => {
  // 'YYYY-MM-DD HH:MM:SS' -> 'DD.MM.YYYY'
  const d = String(sqliteDt || '').slice(0, 10);
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return `${m[3]}.${m[2]}.${m[1]}`;
};

function Packages({ t, userRole = 'user', userPermissions = [] }) {
  const [packages, setPackages] = useState([]);
  const [itemsPerPage] = useState(50);
  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: '', hours: '' });

  const canReadPackages = useMemo(() => {
    if (userRole === 'admin') return true;
    const p = (Array.isArray(userPermissions) ? userPermissions : []).find((x) => x.module === 'packages');
    return Number(p?.can_access_module) === 1 && Number(p?.can_read) === 1;
  }, [userRole, userPermissions]);

  const canWritePackages = useMemo(() => {
    if (userRole === 'admin') return true;
    const p = (Array.isArray(userPermissions) ? userPermissions : []).find((x) => x.module === 'packages');
    return Number(p?.can_access_module) === 1 && Number(p?.can_write) === 1;
  }, [userRole, userPermissions]);

  const loadPackages = useCallback(async () => {
    if (!canReadPackages) {
      setPackages([]);
      return;
    }
    const res = await axios.get(`${getApiBaseUrl()}/packages`);
    setPackages(Array.isArray(res.data) ? res.data : []);
  }, [canReadPackages]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  const filtered = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    const list = Array.isArray(packages) ? packages : [];
    if (!q) return list;
    return list.filter((p) => String(p?.title || '').toLowerCase().includes(q));
  }, [packages, search]);

  const createPackage = async () => {
    if (!canWritePackages) {
      alert('Нямате права за добавяне (packages:write).');
      return;
    }
    const title = String(form.title || '').trim();
    const hours = Number(String(form.hours || '').replace(',', '.'));
    if (!title) {
      alert('Моля въведете име');
      return;
    }
    if (!Number.isFinite(hours) || hours < 0) {
      alert('Моля въведете валидни часове');
      return;
    }
    await axios.post(`${getApiBaseUrl()}/packages`, { title, hours });
    setCreateOpen(false);
    setForm({ title: '', hours: '' });
    loadPackages();
  };

  const deletePackage = async (id) => {
    if (!window.confirm('Сигурни ли сте, че искате да изтриете тази пакетна операция?')) return;
    await axios.delete(`${getApiBaseUrl()}/packages/${id}`);
    loadPackages();
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 }, overflowX: 'hidden' }}>
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <LocalOfferIcon />
        {t ? t('packagesTitle') : 'Пакетни операции'}
      </Typography>

      <Grid container spacing={{ xs: 2, md: 3 }}>
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr auto' },
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                <TextField
                  size="small"
                  placeholder="Търси пакетна операция..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  fullWidth
                />
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    if (!canWritePackages) {
                      alert('Нямате права за добавяне (packages:write).');
                      return;
                    }
                    setCreateOpen(true);
                  }}
                  sx={{ whiteSpace: 'nowrap' }}
                  disabled={!canWritePackages}
                >
                  Нова операция
                </Button>
              </Box>

              {!canReadPackages ? (
                <Typography variant="body2" color="error" sx={{ mt: 1, fontWeight: 800 }}>
                  Нямате достъп до „Пакетни операции“ (packages:read).
                </Typography>
              ) : null}

              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontWeight: 700 }}>
                Показани: {Math.min(filtered.length, itemsPerPage)} от {filtered.length}
              </Typography>

              <List dense sx={{ mt: 1.25, p: 0 }}>
                {filtered.slice(0, itemsPerPage).map((p, index) => {
                  const lastPrice = Number(p?.last_invoiced_price) || 0;
                  const lastDate = toBgDate(p?.last_invoiced_at);
                  return (
                    <div key={p.id}>
                      <ListItem
                        alignItems="flex-start"
                        sx={{
                          px: { xs: 1, sm: 1.5 },
                          py: { xs: 1.1, sm: 1.25 },
                          borderRadius: 2,
                          border: (theme) => `1px solid ${theme.palette.divider}`,
                          '&:hover': { backgroundColor: 'action.hover' },
                        }}
                        secondaryAction={
                          <IconButton
                            onClick={() => deletePackage(p.id)}
                            color="error"
                            size="small"
                            sx={{ width: 34, height: 34 }}
                          >
                            <DeleteIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                              <ScheduleIcon color="primary" sx={{ fontSize: 20, mt: 0.25, flexShrink: 0 }} />
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body1" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                                  {p.title}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.5 }}>
                                  <Chip
                                    label={`${Number(p.hours || 0).toFixed(2).replace(/\.00$/, '')}ч`}
                                    size="small"
                                    color="secondary"
                                    sx={{ fontWeight: 900 }}
                                  />
                                  <Chip
                                    icon={<PaidIcon />}
                                    label={`${lastPrice.toFixed(2)} лв.`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontWeight: 900 }}
                                    title={lastDate ? `Последно фактуриране: ${lastDate}` : 'Няма фактуриране'}
                                  />
                                  {lastDate ? (
                                    <Chip
                                      label={lastDate}
                                      size="small"
                                      variant="outlined"
                                      sx={{ fontWeight: 800 }}
                                    />
                                  ) : null}
                                </Box>
                              </Box>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < Math.min(filtered.length, itemsPerPage) - 1 ? <Divider sx={{ my: 0.5 }} /> : null}
                    </div>
                  );
                })}
                {filtered.length === 0 ? (
                  <ListItem sx={{ px: { xs: 1, sm: 2 } }}>
                    <ListItemText
                      primary="Няма пакетни операции"
                      secondary="Създайте първата пакетна операция с бутона „Нова операция“"
                    />
                  </ListItem>
                ) : null}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
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
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Часове *"
                value={form.hours}
                onChange={(e) => setForm({ ...form, hours: e.target.value })}
                type="number"
                inputProps={{ min: 0, step: '0.1' }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Отказ</Button>
          <Button onClick={createPackage} variant="contained">
            Създай
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default Packages;

