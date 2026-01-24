import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Container,
  Typography,
  TextField,
  Button,
  ButtonBase,
  Grid,
  Card,
  CardContent,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  Box,
  IconButton,
  Chip,
  FormControl,
  Select,
  MenuItem,
  Tabs,
  Tab,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useMediaQuery
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { getApiBaseUrl } from "../api";
import {
  formatCategoryLabel,
  getCategoriesForVehicleType,
  getSubcategoriesForCategoryKey,
  getWorktimeCategoryKey,
  getWorktimeSubcategoryKey,
} from "../utils/worktimeClassification";

export default function Worktimes({ t }) {
  const [worktimes, setWorktimes] = useState([]);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('truck');
  const [activeCategoryKey, setActiveCategoryKey] = useState('regular');
  const [activeSubcategoryKey, setActiveSubcategoryKey] = useState('');
  const isPhone = useMediaQuery('(max-width:600px)');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    title: "",
    hours: "",
    vehicle_type: 'truck',
    component_type: "regular",
  });

  const categories = getCategoriesForVehicleType(vehicleTypeFilter);
  const subcategories = useMemo(
    () => getSubcategoriesForCategoryKey(vehicleTypeFilter, activeCategoryKey),
    [vehicleTypeFilter, activeCategoryKey]
  );

  const countByCategoryKey = useMemo(() => {
    const map = {};
    (worktimes || []).forEach((w) => {
      const key = getWorktimeCategoryKey(w, vehicleTypeFilter);
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [worktimes, vehicleTypeFilter]);

  const filteredWorktimes = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    return (worktimes || [])
      .filter((w) => getWorktimeCategoryKey(w, vehicleTypeFilter) === activeCategoryKey)
      .filter((w) => {
        // Subcategory only applies to trucks. If no subcategory is selected -> show all.
        if (vehicleTypeFilter === 'trailer') return true;
        if (!activeSubcategoryKey) return true;
        return getWorktimeSubcategoryKey(w, vehicleTypeFilter) === activeSubcategoryKey;
      })
      .filter((w) => {
        if (!q) return true;
        return String(w?.title || '').toLowerCase().includes(q);
      });
  }, [worktimes, vehicleTypeFilter, activeCategoryKey, activeSubcategoryKey, search]);

  useEffect(() => {
    loadWorktimes();
  }, []);

  useEffect(() => {
    // Keep selected category valid when filter changes.
    const keys = new Set(getCategoriesForVehicleType(vehicleTypeFilter).map((c) => c.key));
    if (!keys.has(activeCategoryKey)) {
      setActiveCategoryKey(getCategoriesForVehicleType(vehicleTypeFilter)[0]?.key || 'regular');
    }

    // Reset subcategory when switching vehicle type.
    if (vehicleTypeFilter === 'trailer') {
      setActiveSubcategoryKey('');
    }
  }, [vehicleTypeFilter, activeCategoryKey]);

  useEffect(() => {
    // Keep selected subcategory valid when category changes.
    if (vehicleTypeFilter === 'trailer') {
      setActiveSubcategoryKey('');
      return;
    }

    const list = getSubcategoriesForCategoryKey(vehicleTypeFilter, activeCategoryKey);
    const keys = new Set(list.map((s) => s.key));
    if (activeSubcategoryKey && !keys.has(activeSubcategoryKey)) {
      setActiveSubcategoryKey('');
    }
  }, [vehicleTypeFilter, activeCategoryKey, activeSubcategoryKey]);

  async function loadWorktimes() {
    const res = await axios.get(`${getApiBaseUrl()}/worktimes`);
    setWorktimes(res.data);
  }

  async function createWorktime() {
    await axios.post(`${getApiBaseUrl()}/worktimes`, {
      title: form.title,
      hours: form.hours,
      component_type: form.component_type,
    });
    setForm({ title: "", hours: "", vehicle_type: form.vehicle_type, component_type: "regular" });
    loadWorktimes();
  }

  async function deleteWorktime(id) {
    await axios.delete(`${getApiBaseUrl()}/worktimes/${id}`);
    loadWorktimes();
  }

  return (
    <Container
      maxWidth="xl"
      sx={{
        py: { xs: 2, md: 4 },
        // Prevent page-level horizontal scroll (can happen when MUI Tabs scroll buttons render slightly outside).
        overflowX: 'hidden',
      }}
    >
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AccessTimeIcon />
        {t('worktimesTitle')}
      </Typography>

      <Grid container spacing={{ xs: 2, md: 4 }}>
        {/* Create Worktime Form (collapsed on phone) */}
        <Grid item xs={12} lg={5}>
          {isPhone ? (
            <Accordion defaultExpanded={false} sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AddIcon />
                  {t('addWorktime')}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControl fullWidth variant="outlined">
                      <InputLabel>Тип</InputLabel>
                      <Select
                        value={form.vehicle_type}
                        onChange={(e) => {
                          const vt = e.target.value;
                          const firstKey = getCategoriesForVehicleType(vt)[0]?.key || 'regular';
                          setForm({ ...form, vehicle_type: vt, component_type: firstKey });
                        }}
                        label="Тип"
                      >
                        <MenuItem value="truck">Автомобил</MenuItem>
                        <MenuItem value="trailer">Ремарке</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth variant="outlined">
                      <InputLabel>Категория</InputLabel>
                      <Select
                        value={form.component_type}
                        onChange={(e) => setForm({ ...form, component_type: e.target.value })}
                        label="Категория"
                      >
                        {getCategoriesForVehicleType(form.vehicle_type).map((cat) => (
                          <MenuItem key={cat.key} value={cat.key}>
                            {cat.no}. {cat.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label={t('worktimeActivityLabel')}
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label={t('worktimeHoursLabel')}
                      value={form.hours}
                      onChange={(e) => setForm({ ...form, hours: e.target.value })}
                      variant="outlined"
                      type="number"
                      step="0.1"
                      inputProps={{ min: 0 }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={createWorktime}
                      size="large"
                      startIcon={<AddIcon />}
                    >
                      {t('addWorktimeBtn')}
                    </Button>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          ) : (
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AddIcon />
                {t('addWorktime')}
              </Typography>
              <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Тип</InputLabel>
                  <Select
                    value={form.vehicle_type}
                    onChange={(e) => {
                      const vt = e.target.value;
                      const firstKey = getCategoriesForVehicleType(vt)[0]?.key || 'regular';
                      setForm({ ...form, vehicle_type: vt, component_type: firstKey });
                    }}
                    label="Тип"
                  >
                    <MenuItem value="truck">Автомобил</MenuItem>
                    <MenuItem value="trailer">Ремарке</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Категория</InputLabel>
                  <Select
                    value={form.component_type}
                    onChange={(e) => setForm({ ...form, component_type: e.target.value })}
                    label="Категория"
                  >
                    {getCategoriesForVehicleType(form.vehicle_type).map((cat) => (
                      <MenuItem key={cat.key} value={cat.key}>
                        {cat.no}. {cat.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('worktimeActivityLabel')}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('worktimeHoursLabel')}
                  value={form.hours}
                  onChange={(e) => setForm({ ...form, hours: e.target.value })}
                  variant="outlined"
                  type="number"
                 step="0.1"
                 inputProps={{ min: 0 }}
               />
             </Grid>
               <Grid item xs={12}>
                 <Button
                   fullWidth
                   variant="contained"
                   onClick={createWorktime}
                   size="large"
                   startIcon={<AddIcon />}
                 >
                   {t('addWorktimeBtn')}
                 </Button>
               </Grid>
             </Grid>
            </Card>
          )}
        </Grid>

        {/* Worktimes List */}
        <Grid item xs={12} lg={7}>
          <Card sx={{ overflowX: 'hidden' }}>
            <CardContent sx={{ overflowX: 'hidden', p: { xs: 1.5, sm: 2 } }}>
              <Typography variant="h6" gutterBottom>
                {t('standardWorktimes')} ({worktimes.length})
              </Typography>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs
                  value={vehicleTypeFilter}
                  onChange={(e, newValue) => {
                    setVehicleTypeFilter(newValue);
                    setActiveCategoryKey(getCategoriesForVehicleType(newValue)[0]?.key || 'regular');
                  }}
                  variant="scrollable"
                  scrollButtons="auto"
                  allowScrollButtonsMobile
                  sx={{
                    minHeight: 40,
                    maxWidth: '100%',
                    '& .MuiTabs-scroller': {
                      overflowX: 'auto',
                    },
                    '& .MuiTab-root': {
                      minHeight: 40,
                      paddingTop: 0.5,
                      paddingBottom: 0.5,
                      paddingLeft: 1.25,
                      paddingRight: 1.25,
                      fontWeight: 900,
                      textTransform: 'none',
                      fontSize: { xs: '0.85rem', sm: '0.95rem' },
                      minWidth: 'auto',
                    },
                    '& .MuiTabs-scrollButtons': {
                      width: 28,
                      height: 28,
                    }
                  }}
                >
                  <Tab value="truck" label="Автомобили" />
                  <Tab value="trailer" label="Ремаркета" />
                </Tabs>
              </Box>

              {/* Category selector (grid buttons like the "normovremena" picker) */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 1, pb: 1.25 }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
                    gap: 1,
                    alignItems: 'stretch',
                  }}
                >
                  {categories.map((cat) => {
                    const isActive = activeCategoryKey === cat.key;
                    const count = countByCategoryKey[cat.key] || 0;
                    const label = String(cat?.label || '');
                    // If a category label is long, make it smaller on mobile so it fits better.
                    const isLongLabel = label.length >= 16;
                    const categoryLabelFontSize = {
                      xs: isLongLabel ? 10 : 11,
                      sm: isLongLabel ? '0.80rem' : '0.86rem',
                      md: isLongLabel ? '0.84rem' : '0.90rem',
                    };
                    // Allow more lines on mobile so labels can fit without needing ellipsis.
                    const categoryLabelMaxHeight = {
                      xs: isLongLabel ? '5.0em' : '4.2em',
                      sm: 'none',
                      // Web/desktop: allow up to ~2 lines (avoid ellipsis for long labels).
                      md: isLongLabel ? '2.6em' : '2.4em',
                    };

                    return (
                      <ButtonBase
                        key={cat.key}
                        onClick={() => {
                          setActiveCategoryKey(cat.key);
                          // Reset subcategory when category changes.
                          setActiveSubcategoryKey('');
                        }}
                        sx={(theme) => ({
                          width: '100%',
                          textAlign: 'left',
                          borderRadius: 999,
                          border: `1px solid ${isActive ? theme.palette.primary.main : theme.palette.divider}`,
                          backgroundColor: isActive ? theme.palette.primary.main : 'transparent',
                          color: isActive ? theme.palette.primary.contrastText : theme.palette.text.primary,
                          padding: { xs: '8px 10px', sm: '10px 12px' },
                          minHeight: { xs: 44, sm: 46, md: 54 },
                          display: 'grid',
                          gridTemplateColumns: { xs: '22px minmax(0, 1fr) auto', sm: '28px minmax(0, 1fr) auto' },
                          alignItems: 'center',
                          columnGap: { xs: 8, sm: 10 },
                          overflow: 'hidden',
                          transition: 'background-color 120ms ease, border-color 120ms ease',
                          '&:hover': {
                            backgroundColor: isActive
                              ? theme.palette.primary.dark
                              : theme.palette.action.hover,
                          },
                        })}
                      >
                        <Box
                          sx={{
                            width: { xs: 22, sm: 28 },
                            textAlign: 'center',
                            fontWeight: 900,
                            fontSize: { xs: '0.95rem', sm: '1rem' },
                            lineHeight: 1,
                          }}
                        >
                          {cat.no}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 900,
                              // Phone: allow wrapping (no "...") and keep buttons aligned.
                              whiteSpace: { xs: 'normal', sm: 'nowrap', md: 'normal' },
                              overflow: { xs: 'hidden', sm: 'hidden', md: 'hidden' },
                              textOverflow: { xs: 'clip', sm: 'ellipsis', md: 'clip' },
                              display: 'block',
                              wordBreak: { xs: 'break-word', sm: 'normal' },
                              overflowWrap: { xs: 'anywhere', sm: 'normal' },
                              lineHeight: { xs: 1.08, sm: 1.2 },
                              fontSize: categoryLabelFontSize,
                              // Visually cap to ~3 lines on phone without adding ellipsis.
                              maxHeight: categoryLabelMaxHeight,
                            }}
                            title={cat.label}
                          >
                            {cat.label}
                          </Typography>
                        </Box>
                        <Chip
                          label={count}
                          size="small"
                          variant={isActive ? 'filled' : 'outlined'}
                          sx={(theme) => ({
                            fontWeight: 900,
                            height: { xs: 22, sm: 24 },
                            minWidth: { xs: 26, sm: 34 },
                            fontSize: { xs: 10, sm: 12 },
                            flexShrink: 0,
                            justifySelf: 'end',
                            borderColor: isActive ? 'transparent' : theme.palette.primary.main,
                            backgroundColor: isActive ? theme.palette.primary.light : 'transparent',
                            color: isActive ? theme.palette.primary.contrastText : theme.palette.primary.main,
                          })}
                        />
                      </ButtonBase>
                    );
                  })}
                </Box>
              </Box>

              {/* Truck subcategory list (screenshot-style list with chevron) */}
              {vehicleTypeFilter !== 'trailer' && subcategories.length > 0 ? (
                <Box sx={{ mt: 1.25 }}>
                  <Paper
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <List dense sx={{ p: 0 }}>
                      {/* "All" row */}
                      <ListItem
                        disablePadding
                        selected={!activeSubcategoryKey}
                        onClick={() => setActiveSubcategoryKey('')}
                        sx={{ cursor: 'pointer' }}
                      >
                        <ListItemText
                          primary={t('all')}
                          primaryTypographyProps={{ sx: { fontWeight: 900 } }}
                          sx={{ px: 1.5, py: 0.75 }}
                        />
                      </ListItem>
                      <Divider />

                      {subcategories.map((sub, idx) => {
                        const isSelected = activeSubcategoryKey === sub.key;
                        return (
                          <div key={sub.key}>
                            <ListItem
                              disablePadding
                              selected={isSelected}
                              onClick={() => setActiveSubcategoryKey(sub.key)}
                              sx={{ cursor: 'pointer' }}
                            >
                              <ListItemText
                                primary={`${sub.no}. ${sub.label}`}
                                primaryTypographyProps={{
                                  sx: {
                                    fontWeight: 800,
                                    // Match screenshot: single line with ellipsis
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  },
                                }}
                                sx={{ px: 1.5, py: 0.75 }}
                              />
                              <Box sx={{ pr: 1.25, color: 'text.secondary', fontWeight: 900 }}>
                                »
                              </Box>
                            </ListItem>
                            {idx < subcategories.length - 1 ? <Divider /> : null}
                          </div>
                        );
                      })}
                    </List>
                  </Paper>
                </Box>
              ) : null}

              <Box sx={{ mt: 2 }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr auto' },
                    gap: 1,
                    alignItems: 'center',
                    mb: 1.5,
                  }}
                >
                  <TextField
                    size="small"
                    placeholder={t('search')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    fullWidth
                  />
                  <FormControl size="small" sx={{ minWidth: 100, justifySelf: { xs: 'start', sm: 'end' } }}>
                    <Select value={itemsPerPage} onChange={(e) => setItemsPerPage(e.target.value)}>
                      <MenuItem value={10}>10</MenuItem>
                      <MenuItem value={25}>25</MenuItem>
                      <MenuItem value={50}>50</MenuItem>
                      <MenuItem value={100}>100</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <List dense sx={{ p: 0 }}>
                  {filteredWorktimes.slice(0, itemsPerPage).map((w, index) => (
                      <div key={w.id}>
                        <ListItem
                          alignItems="flex-start"
                          sx={{
                            px: { xs: 1, sm: 1.5 },
                            py: { xs: 1.1, sm: 1.25 },
                            borderRadius: 2,
                            border: (theme) => `1px solid ${theme.palette.divider}`,
                            '&:hover': { backgroundColor: 'action.hover' },
                          }}
                        >
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                <ScheduleIcon color="primary" sx={{ fontSize: 20, mt: 0.25, flexShrink: 0 }} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography
                                    variant="body1"
                                    sx={{
                                      fontWeight: 900,
                                      lineHeight: 1.2,
                                      wordBreak: 'break-word',
                                      overflowWrap: 'break-word',
                                    }}
                                  >
                                    {w.title}
                                  </Typography>
                                  {!isPhone ? (
                                    <Typography variant="caption" color="text.secondary">
                                      {formatCategoryLabel(vehicleTypeFilter, w.component_type)}
                                    </Typography>
                                  ) : null}
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                                  <Chip
                                    label={`${Number(w.hours || 0).toFixed(2).replace(/\.00$/, '')}${t('hoursShortSuffix')}`}
                                    color="secondary"
                                    size="small"
                                    sx={{ fontWeight: 900 }}
                                  />
                                  <IconButton
                                    onClick={() => deleteWorktime(w.id)}
                                    color="error"
                                    size="small"
                                    sx={{ width: 34, height: 34 }}
                                  >
                                    <DeleteIcon sx={{ fontSize: 18 }} />
                                  </IconButton>
                                </Box>
                              </Box>
                            }
                            secondary={
                              !isPhone ? (
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                  {t('worktimeDescription')}
                                </Typography>
                              ) : null
                            }
                          />
                        </ListItem>
                        {index < Math.min(filteredWorktimes.length, itemsPerPage) - 1 ? <Divider sx={{ my: 0.5 }} /> : null}
                      </div>
                    ))}
                  {filteredWorktimes.length === 0 && (
                    <ListItem sx={{ px: { xs: 1, sm: 2 } }}>
                      <ListItemText
                        primary={t('noWorktimesSelectedComponent')}
                        secondary={t('addFirstWorktimeForComponent')}
                      />
                    </ListItem>
                  )}
                </List>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
