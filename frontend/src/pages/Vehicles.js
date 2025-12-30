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
  useMediaQuery
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import BuildIcon from "@mui/icons-material/Build";
import PersonIcon from "@mui/icons-material/Person";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import RvHookupIcon from "@mui/icons-material/RvHookup";
import { getApiBaseUrl } from "../api";
import { formatCategoryLabel } from "../utils/worktimeClassification";

export default function Vehicles({ t, setPage }) {
  const langCode = (typeof window !== 'undefined' && localStorage.getItem('language')) || 'bg';
  const locale = langCode === 'bg' ? 'bg-BG' : langCode === 'de' ? 'de-DE' : 'en-US';

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

  const [orderDetailsDialogOpen, setOrderDetailsDialogOpen] = useState(false);
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState(null);
  const [historyOrderWorktimes, setHistoryOrderWorktimes] = useState([]);
  const [historyOrderWorktimesLoading, setHistoryOrderWorktimesLoading] = useState(false);

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

  const openHistoryOrderDetails = async (order) => {
    setSelectedHistoryOrder(order);
    setOrderDetailsDialogOpen(true);
    await loadHistoryOrderWorktimes(order.id);
  };

  const handleVehicleClick = (vehicle) => {
    setSelectedVehicle(vehicle);
    loadServiceHistory(vehicle.id);
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
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<BuildIcon />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVehicleClick(vehicle);
                          }}
                        >
                          {t('history')}
                        </Button>
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
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<BuildIcon />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVehicleClick(vehicle);
                            }}
                          >
                            {t('history')}
                          </Button>
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
                        {new Date(order.created_at).toLocaleDateString('bg-BG')}
                        {new Date(order.created_at).toLocaleDateString(locale)}
                      </Typography>
                      <Chip
                        label={order.status === 'active' ? t('statusActive') : t('statusCompleted')}
                        color={order.status === 'active' ? 'primary' : 'default'}
                        size="small"
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
                    <Typography variant="body2" color="text.secondary">
                      {t('client')}: {order.client_name}
                    </Typography>

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
          <Button onClick={() => setHistoryDialogOpen(false)}>{t('close')}</Button>
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
                {t('date')}: <strong>{new Date(selectedHistoryOrder.created_at).toLocaleString(locale)}</strong>
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>{t('complaintLabel')}:</strong> {selectedHistoryOrder.complaint}
              </Typography>
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
    </Container>
  );
}
