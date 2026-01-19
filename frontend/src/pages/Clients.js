import { useEffect, useState } from "react";
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
  Chip,
  InputAdornment,
  IconButton,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  ListItemIcon,
  FormControl,
  Select,
  useMediaQuery
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import BusinessIcon from "@mui/icons-material/Business";
import AddIcon from "@mui/icons-material/Add";
import AssignmentIcon from "@mui/icons-material/Assignment";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import RvHookupIcon from "@mui/icons-material/RvHookup";
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { getApiBaseUrl } from "../api";

export default function Clients({ t, setPage }) {
  const fullScreenDialog = useMediaQuery('(max-width:600px)');
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    address: "",
    city: "",
    eik: "",
    vat_number: "",
    mol: "",
    phone: "",
  });
  const [vehicleForm, setVehicleForm] = useState({
    reg_number: "",
    vin: "",
    brand: "",
    model: "",
    vehicle_type: "truck",
    gear_box: "",
    axes: "",
    year: null,
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [vehicleMenuAnchor, setVehicleMenuAnchor] = useState(null);
  const [addVehicleDialogOpen, setAddVehicleDialogOpen] = useState(false);
  const [clientVehicles, setClientVehicles] = useState({});
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [invoiceStatsByClientName, setInvoiceStatsByClientName] = useState({});

  // Create order directly from a selected vehicle (with confirmation)
  const [createOrderConfirmOpen, setCreateOrderConfirmOpen] = useState(false);
  const [pendingOrderVehicle, setPendingOrderVehicle] = useState(null); // vehicle row
  const [orderComplaintDraft, setOrderComplaintDraft] = useState('');

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    address: "",
    city: "",
    eik: "",
    vat_number: "",
    mol: "",
    phone: "",
  });

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInvoiceStats() {
    try {
      const res = await axios.get(`${getApiBaseUrl()}/clients/invoice-stats`);
      const rows = Array.isArray(res.data) ? res.data : [];
      const map = {};
      rows.forEach((r) => {
        const name = String(r?.client_name || '').trim();
        if (!name) return;
        map[name] = {
          notInvoiced: Number(r?.not_invoiced) || 0,
          invoicedUnpaid: Number(r?.invoiced_unpaid) || 0,
          paid: Number(r?.paid) || 0,
        };
      });
      setInvoiceStatsByClientName(map);
    } catch {
      setInvoiceStatsByClientName({});
    }
  }

  async function loadVehiclesForClients(clientList) {
    const vehiclesMap = {};
    for (const client of clientList || []) {
      try {
        const vehiclesRes = await axios.get(`${getApiBaseUrl()}/vehicles/client/${client.id}`);
        vehiclesMap[client.id] = vehiclesRes.data;
      } catch {
        vehiclesMap[client.id] = [];
      }
    }
    setClientVehicles(vehiclesMap);
  }

  async function loadClients() {
    const res = await axios.get(`${getApiBaseUrl()}/clients`);
    setClients(res.data);

    await Promise.all([loadVehiclesForClients(res.data), loadInvoiceStats()]);
  }

  async function searchClients() {
    if (search.trim()) {
      const res = await axios.get(`${getApiBaseUrl()}/clients/search?q=${search}`);
      setClients(res.data);
      await loadVehiclesForClients(res.data);
      await loadInvoiceStats();
    } else {
      loadClients();
    }
  }

  async function createClient() {
    await axios.post(`${getApiBaseUrl()}/clients`, form);
    setForm({ name: "", email: "", address: "", city: "", eik: "", vat_number: "", mol: "", phone: "" });
    setCreateDialogOpen(false);
    loadClients();
  }

  const openEditClient = (client) => {
    setEditClient(client);
    setEditForm({
      name: client.name || '',
      email: client.email || '',
      address: client.address || '',
      city: client.city || '',
      eik: client.eik || '',
      vat_number: client.vat_number || '',
      mol: client.mol || '',
      phone: client.phone || '',
    });
    setEditDialogOpen(true);
  };

  const saveClientEdits = async () => {
    if (!editClient) return;
    try {
      await axios.put(`${getApiBaseUrl()}/clients/${editClient.id}`, editForm);
      setEditDialogOpen(false);
      setEditClient(null);
      loadClients();
    } catch (error) {
      alert(t('editClientError'));
    }
  };

  const handleClientClick = (event, client) => {
    setSelectedClient(client);
    setVehicleMenuAnchor(event.currentTarget);
  };

  const openCreateOrderMenuForClient = (event, client) => {
    event.stopPropagation();
    setSelectedClient(client);
    setVehicleMenuAnchor(event.currentTarget);
  };

  // Close the menu but keep the selected client in state (used when opening sub-dialogs).
  const closeVehicleMenuOnly = () => {
    setVehicleMenuAnchor(null);
  };

  const handleVehicleMenuClose = () => {
    setVehicleMenuAnchor(null);
    setSelectedClient(null);
  };

  const requestCreateOrderForVehicle = (vehicleRow) => {
    setPendingOrderVehicle(vehicleRow || null);
    setOrderComplaintDraft('');
    closeVehicleMenuOnly();
    setCreateOrderConfirmOpen(true);
  };

  const confirmCreateOrderForVehicle = async () => {
    if (!selectedClient?.id || !pendingOrderVehicle?.reg_number) return;
    try {
      const complaintText = String(orderComplaintDraft || '').trim() || 'Няма добавено оплакване';
      await axios.post(`${getApiBaseUrl()}/orders`, {
        client_id: selectedClient.id,
        client_name: selectedClient.name,
        reg_number: String(pendingOrderVehicle.reg_number || '').trim(),
        complaint: complaintText,
      });
      setCreateOrderConfirmOpen(false);
      setPendingOrderVehicle(null);
      setOrderComplaintDraft('');
      handleVehicleMenuClose();
      setPage(2); // Orders page
    } catch (e) {
      alert('Грешка при създаване на поръчка.');
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (window.confirm(t('deleteClientConfirm'))) {
      try {
        await axios.delete(`${getApiBaseUrl()}/clients/${clientId}`);
        loadClients();
      } catch (error) {
        alert(t('deleteClientError'));
      }
    }
  };

  const handleDeleteVehicleFromClient = async (clientId, vehicle) => {
    const vehicleId = vehicle?.id;
    if (!clientId || !vehicleId) return;
    const reg = String(vehicle?.reg_number || '').trim();
    const label = reg ? ` (${reg})` : '';
    if (!window.confirm(`Да се премахне ли този автомобил${label} от клиента?`)) return;

    try {
      await axios.delete(`${getApiBaseUrl()}/vehicles/${vehicleId}`);
      // Optimistic UI update (avoid refetching all clients)
      setClientVehicles((prev) => {
        const next = { ...(prev || {}) };
        const list = Array.isArray(next[clientId]) ? next[clientId] : [];
        next[clientId] = list.filter((v) => v?.id !== vehicleId);
        return next;
      });
    } catch (error) {
      alert('Грешка при премахване на автомобила.');
    }
  };


  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <BusinessIcon />
        {t('clientsTitle')}
      </Typography>

      {/* Search */}
      <Box sx={{ mb: 4 }}>
        <TextField
          fullWidth
          placeholder={t('searchClients')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && searchClients()}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={searchClients}>
                  <SearchIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
          variant="outlined"
        />
      </Box>

      {/* Clients List */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              {t('clientsList')} ({clients.length})
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
          <List>
            {clients.slice(0, itemsPerPage).map((c, index) => (
              <div key={c.id}>
                <ListItem
                  alignItems="flex-start"
                  button
                  onClick={(event) => handleClientClick(event, c)}
                  sx={{
                    overflowX: 'hidden',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                    py: { xs: 2, sm: 1.5 },
                    px: { xs: 2, sm: 1 }
                  }}
                >
                  <ListItemText
                    sx={{ minWidth: 0 }}
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <BusinessIcon color="primary" />
                        <Typography variant="h6" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{c.name}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 900, color: 'error.main', minWidth: 14, textAlign: 'right' }}
                            title="Нефактурирани"
                          >
                            {invoiceStatsByClientName?.[c.name]?.notInvoiced ?? 0}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 900 }}>
                            /
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 900, color: 'success.main', minWidth: 14, textAlign: 'right' }}
                            title="Фактурирани (неплатени)"
                          >
                            {invoiceStatsByClientName?.[c.name]?.invoicedUnpaid ?? 0}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 900 }}>
                            /
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 900, color: 'warning.main', minWidth: 14, textAlign: 'right' }}
                            title="Платени"
                          >
                            {invoiceStatsByClientName?.[c.name]?.paid ?? 0}
                          </Typography>
                        </Box>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1, minWidth: 0 }}>
                        <Typography variant="body2" color="text.secondary">
                          📍 {c.address}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          📋 {t('eik')}: {c.eik} | 📞 {t('phone')}: {c.phone}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          ✉️ {t('email')}: {c.email || '—'}
                        </Typography>
                        {(c.vat_number || c.city || c.mol) && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {c.vat_number ? `💳 ${t('vatNumber')}: ${c.vat_number}` : ''}{c.vat_number && (c.city || c.mol) ? ' | ' : ''}
                            {c.city ? `🏙️ ${t('city')}: ${c.city}` : ''}{c.city && c.mol ? ' | ' : ''}
                            {c.mol ? `👤 ${t('mol')}: ${c.mol}` : ''}
                          </Typography>
                        )}
                        <Box sx={{ mt: 1 }}>
                          <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <LocalShippingIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                              <Typography variant="body2">
                                {t('trucksLabel')}: {(clientVehicles[c.id] || []).filter(v => v.vehicle_type === 'truck').length}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <RvHookupIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
                              <Typography variant="body2">
                                {t('trailersLabel')}: {(clientVehicles[c.id] || []).filter(v => v.vehicle_type === 'trailer').length}
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                            {clientVehicles[c.id] && clientVehicles[c.id].length > 0 && (
                              <>
                                {clientVehicles[c.id].slice(0, 3).map((vehicle, idx) => (
                                  <Chip
                                    key={idx}
                                    label={`${vehicle.brand} ${vehicle.model} (${vehicle.reg_number})`}
                                    size="small"
                                    variant="outlined"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Navigate to vehicle details/history
                                      setPage(4); // Vehicles page
                                    }}
                                    onDelete={(e) => {
                                      e.stopPropagation();
                                      handleDeleteVehicleFromClient(c.id, vehicle);
                                    }}
                                    deleteIcon={<DeleteIcon />}
                                    sx={{ cursor: 'pointer' }}
                                  />
                                ))}
                                {clientVehicles[c.id].length > 3 && (
                                  <Chip
                                    label={`+${clientVehicles[c.id].length - 3} ${t('more')}`}
                                    size="small"
                                    variant="outlined"
                                  />
                                )}
                              </>
                            )}
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClient(c);
                                setAddVehicleDialogOpen(true);
                              }}
                              color="primary"
                              sx={{
                                ml: 1,
                                width: { xs: 36, sm: 32 },
                                height: { xs: 36, sm: 32 }
                              }}
                            >
                              <AddCircleIcon sx={{ fontSize: { xs: 20, sm: 18 } }} />
                            </IconButton>
                          </Box>
                        </Box>
                        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<AssignmentIcon />}
                            onClick={(e) => openCreateOrderMenuForClient(e, c)}
                            sx={{
                              minHeight: { xs: 36, sm: 32 },
                              fontSize: { xs: '0.875rem', sm: '0.75rem' },
                              flex: { xs: '1 1 100%', sm: '0 0 auto' },
                            }}
                          >
                            Създай поръчка
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditClient(c);
                            }}
                            sx={{
                              minHeight: { xs: 36, sm: 32 },
                              fontSize: { xs: '0.875rem', sm: '0.75rem' },
                              flex: { xs: '1 1 100%', sm: '0 0 auto' },
                            }}
                          >
                            {t('edit')}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClient(c.id);
                            }}
                            sx={{
                              minHeight: { xs: 36, sm: 32 },
                              fontSize: { xs: '0.875rem', sm: '0.75rem' },
                              flex: { xs: '1 1 100%', sm: '0 0 auto' },
                            }}
                          >
                            {t('delete')}
                          </Button>
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
                {index < clients.length - 1 && <Divider />}
              </div>
            ))}
            {clients.length === 0 && (
              <ListItem>
                <ListItemText
                  primary={t('noClientsFound')}
                  secondary={t('addFirstClientOrChangeSearch')}
                />
              </ListItem>
            )}
          </List>
        </CardContent>
      </Card>

      {/* Floating Action Button for Create Client */}
      <Fab
        color="primary"
        aria-label="add client"
        onClick={() => setCreateDialogOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 80,
          right: 16,
          zIndex: 1000
        }}
      >
        <AddIcon />
      </Fab>

      {/* Create Client Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={fullScreenDialog}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonAddIcon />
          {t('createClient')}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('companyName')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('email')}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('address')}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('city')}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('eik')}
                value={form.eik}
                onChange={(e) => setForm({ ...form, eik: e.target.value })}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('phone')}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('vatNumber')}
                value={form.vat_number}
                onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('mol')}
                value={form.mol}
                onChange={(e) => setForm({ ...form, mol: e.target.value })}
                variant="outlined"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>{t('cancel')}</Button>
          <Button onClick={createClient} variant="contained" startIcon={<PersonAddIcon />}>
            {t('createClientBtn')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={fullScreenDialog}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon /> {t('editClientTitle')}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField fullWidth label={t('companyName')} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('email')}
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label={t('address')} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label={t('city')} value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={t('eik')} value={editForm.eik} onChange={(e) => setEditForm({ ...editForm, eik: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={t('phone')} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={t('vatNumber')} value={editForm.vat_number} onChange={(e) => setEditForm({ ...editForm, vat_number: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label={t('mol')} value={editForm.mol} onChange={(e) => setEditForm({ ...editForm, mol: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>{t('cancel')}</Button>
          <Button onClick={saveClientEdits} variant="contained" startIcon={<EditIcon />}>{t('save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Add Vehicle Dialog */}
      <Dialog open={addVehicleDialogOpen} onClose={() => setAddVehicleDialogOpen(false)} maxWidth="md" fullWidth fullScreen={fullScreenDialog}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddCircleIcon />
          {t('addVehicleToClient')} {selectedClient?.name}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('regNumberRequired')}
                value={vehicleForm.reg_number}
                onChange={(e) => setVehicleForm({ ...vehicleForm, reg_number: e.target.value })}
                variant="outlined"
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('vinNumber')}
                value={vehicleForm.vin}
                onChange={(e) => setVehicleForm({ ...vehicleForm, vin: e.target.value })}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('brandRequired')}
                value={vehicleForm.brand}
                onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })}
                variant="outlined"
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('modelRequired')}
                value={vehicleForm.model}
                onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                variant="outlined"
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label={t('vehicleTypeRequired')}
                value={vehicleForm.vehicle_type}
                onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value })}
                variant="outlined"
                required
              >
                <MenuItem value="truck">{t('truck')}</MenuItem>
                <MenuItem value="trailer">{t('trailer')}</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <DatePicker
                label={t('yearLabel')}
                value={vehicleForm.year}
                onChange={(newValue) => setVehicleForm({ ...vehicleForm, year: newValue })}
                views={['year']}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    variant: "outlined"
                  }
                }}
              />
            </Grid>
            {vehicleForm.vehicle_type === 'truck' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('gearBox')}
                  value={vehicleForm.gear_box}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, gear_box: e.target.value })}
                  variant="outlined"
                  placeholder={t('gearBoxPlaceholder')}
                />
              </Grid>
            )}
            {vehicleForm.vehicle_type === 'trailer' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('axesCount')}
                  type="number"
                  value={vehicleForm.axes}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, axes: e.target.value })}
                  variant="outlined"
                  placeholder={t('axesPlaceholder')}
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddVehicleDialogOpen(false)}>{t('cancel')}</Button>
          <Button
            onClick={async () => {
              if (!vehicleForm.reg_number || !vehicleForm.brand || !vehicleForm.model) {
                alert(t('requiredFieldsVehicle'));
                return;
              }

              try {
                await axios.post(`${getApiBaseUrl()}/vehicles`, {
                  ...vehicleForm,
                  year: vehicleForm.year ? vehicleForm.year.year() : null,
                  client_id: selectedClient.id
                });
                setVehicleForm({
                  reg_number: "",
                  vin: "",
                  brand: "",
                  model: "",
                  vehicle_type: "truck",
                  gear_box: "",
                  axes: "",
                  year: null,
                });
                setAddVehicleDialogOpen(false);
                loadClients();
              } catch (error) {
                alert(t('addVehicleError'));
              }
            }}
            variant="contained"
            startIcon={<AddCircleIcon />}
          >
            {t('addVehicle')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Vehicle Menu */}
      <Menu
        anchorEl={vehicleMenuAnchor}
        open={Boolean(vehicleMenuAnchor)}
        onClose={handleVehicleMenuClose}
        anchorOrigin={{
          vertical: 'center',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'center',
          horizontal: 'left',
        }}
      >
        <MenuItem disabled>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            🚛 {t('vehiclesOfClient')} {selectedClient?.name}
          </Typography>
        </MenuItem>
        <Divider />

        <MenuItem
          onClick={() => {
            if (!selectedClient) return;
            closeVehicleMenuOnly();
            setAddVehicleDialogOpen(true);
          }}
        >
          <ListItemIcon>
            <AddCircleIcon color="primary" />
          </ListItemIcon>
          <ListItemText primary="Добави автомобил" />
        </MenuItem>

        <Divider />

        {clientVehicles[selectedClient?.id]?.map((vehicle, idx) => (
          <MenuItem
            key={idx}
            onClick={() => requestCreateOrderForVehicle(vehicle)}
            sx={{ minWidth: 250 }}
          >
            <ListItemIcon>
              {vehicle.vehicle_type === 'truck' ? (
                <LocalShippingIcon sx={{ color: 'primary.main' }} />
              ) : (
                <RvHookupIcon sx={{ color: 'secondary.main' }} />
              )}
            </ListItemIcon>
            <ListItemText
              primary={`${vehicle.brand} ${vehicle.model}`}
              secondary={vehicle.reg_number}
            />
            <AssignmentIcon sx={{ ml: 1, color: 'primary.main' }} />

            <IconButton
              size="small"
              aria-label="delete vehicle"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteVehicleFromClient(selectedClient?.id, vehicle);
              }}
              sx={{ ml: 1 }}
            >
              <DeleteIcon fontSize="small" color="error" />
            </IconButton>
          </MenuItem>
        ))}
        {(!clientVehicles[selectedClient?.id] || clientVehicles[selectedClient?.id].length === 0) && (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              {t('noRegisteredVehicles')}
            </Typography>
          </MenuItem>
        )}
      </Menu>

      {/* Confirm create order */}
      <Dialog
        open={createOrderConfirmOpen}
        onClose={() => {
          setCreateOrderConfirmOpen(false);
          setPendingOrderVehicle(null);
        }}
        maxWidth="xs"
        fullWidth
        fullScreen={fullScreenDialog}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 900 }}>
          <AssignmentIcon color="primary" />
          Потвърждение
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Да се създаде ли <strong>нова поръчка</strong> за клиент <strong>{selectedClient?.name || '—'}</strong>
            {pendingOrderVehicle?.reg_number ? (
              <>
                {' '}и автомобил <strong>{pendingOrderVehicle.reg_number}</strong>
              </>
            ) : null}
            ?
          </Typography>

          <TextField
            fullWidth
            label="Оплакване"
            placeholder="Опишете оплакването..."
            value={orderComplaintDraft}
            onChange={(e) => setOrderComplaintDraft(e.target.value)}
            multiline
            minRows={3}
            sx={{ mt: 2 }}
            helperText={
              String(orderComplaintDraft || '').trim()
                ? ''
                : 'Ако оставите празно, в поръчката ще се запише: „Няма добавено оплакване“.'
            }
          />

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            След потвърждение ще бъдете прехвърлени към „Работна карта“.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCreateOrderConfirmOpen(false);
              setPendingOrderVehicle(null);
            }}
          >
            Отказ
          </Button>
          <Button variant="contained" onClick={confirmCreateOrderForVehicle} startIcon={<AssignmentIcon />}>
            Създай поръчка
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
