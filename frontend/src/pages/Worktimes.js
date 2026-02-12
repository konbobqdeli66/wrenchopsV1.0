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
  CardActionArea,
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
import { filterCategoriesByGroupAccess } from "../utils/worktimeGroupAccess";
import { ciIncludes, normCi } from "../utils/ciSearch";

export default function Worktimes({ t, userPermissions, userRole }) {
  const [worktimes, setWorktimes] = useState([]);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('truck');
  const [activeCategoryKey, setActiveCategoryKey] = useState('regular');
  const [activeSubcategoryKey, setActiveSubcategoryKey] = useState('');
  // Navigation level: Main group -> Subgroup -> Worktimes list
  const [navStep, setNavStep] = useState('category'); // 'category' | 'subcategory' | 'worktimes'
  const isPhone = useMediaQuery('(max-width:600px)');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    title: "",
    hours: "",
    vehicle_type: 'truck',
    // Main category key (e.g. "engine")
    component_type: "regular",
    // Truck-only subcategory numeric key (e.g. "21")
    subcomponent_type: "",
  });

  const isFreeOpsCategoryKey = (key) => String(key || '').trim() === 'free_ops';

  const categories = useMemo(() => {
    const all = getCategoriesForVehicleType(vehicleTypeFilter);
    return filterCategoriesByGroupAccess({
      categories: all,
      userRole,
      userPermissions,
      vehicleType: vehicleTypeFilter,
    });
  }, [vehicleTypeFilter, userRole, userPermissions]);
  const subcategories = useMemo(
    () => getSubcategoriesForCategoryKey(vehicleTypeFilter, activeCategoryKey),
    [vehicleTypeFilter, activeCategoryKey]
  );

  const activeCategoryHasSubcategories = useMemo(() => {
    if (vehicleTypeFilter === 'trailer') return false;
    const list = getSubcategoriesForCategoryKey(vehicleTypeFilter, activeCategoryKey);
    return Array.isArray(list) && list.length > 0;
  }, [vehicleTypeFilter, activeCategoryKey]);

  const hasLegacyWorktimesInActiveCategory = useMemo(() => {
    if (vehicleTypeFilter === 'trailer') return false;
    return (worktimes || []).some((w) => {
      if (getWorktimeCategoryKey(w, vehicleTypeFilter) !== activeCategoryKey) return false;
      // Legacy / non-numeric component_type values have no subcategory key.
      return !getWorktimeSubcategoryKey(w, vehicleTypeFilter);
    });
  }, [worktimes, vehicleTypeFilter, activeCategoryKey]);

  const subcategoriesWithLegacy = useMemo(() => {
    if (vehicleTypeFilter === 'trailer') return [];
    if (!activeCategoryHasSubcategories) return [];
    const base = Array.isArray(subcategories) ? subcategories : [];
    if (!hasLegacyWorktimesInActiveCategory) return base;
    return [
      ...base,
      { key: '__legacy__', no: '—', label: 'Неразпределени (стар тип)' },
    ];
  }, [vehicleTypeFilter, subcategories, hasLegacyWorktimesInActiveCategory, activeCategoryHasSubcategories]);

  const countByCategoryKey = useMemo(() => {
    const map = {};
    (worktimes || []).forEach((w) => {
      const key = getWorktimeCategoryKey(w, vehicleTypeFilter);
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [worktimes, vehicleTypeFilter]);

  const countBySubcategoryKey = useMemo(() => {
    const map = {};
    if (vehicleTypeFilter === 'trailer') return map;

    (worktimes || []).forEach((w) => {
      if (getWorktimeCategoryKey(w, vehicleTypeFilter) !== activeCategoryKey) return;
      const subKey = getWorktimeSubcategoryKey(w, vehicleTypeFilter);
      const key = subKey ? subKey : '__legacy__';
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [worktimes, vehicleTypeFilter, activeCategoryKey]);

  const filteredWorktimes = useMemo(() => {
    // Only show worktimes after the user reaches the final step.
    if (navStep !== 'worktimes') return [];

    const q = normCi(search).trim();
    return (worktimes || [])
      .filter((w) => getWorktimeCategoryKey(w, vehicleTypeFilter) === activeCategoryKey)
      .filter((w) => {
        // Subcategory applies only to trucks.
        if (vehicleTypeFilter === 'trailer') return true;
        if (!activeCategoryHasSubcategories) return true;
        if (!subcategoriesWithLegacy.length) return true;

        // Enforce the hierarchy: Category -> Subcategory -> Worktime.
        // If a subcategory exists, show only worktimes for the selected subcategory.
        if (!activeSubcategoryKey) return false;
        const subKey = getWorktimeSubcategoryKey(w, vehicleTypeFilter);
        if (activeSubcategoryKey === '__legacy__') return !subKey;
        return subKey === activeSubcategoryKey;
      })
      .filter((w) => {
        if (!q) return true;
        return ciIncludes(w?.title, q);
      });
  }, [worktimes, vehicleTypeFilter, activeCategoryKey, activeSubcategoryKey, search, subcategoriesWithLegacy.length, navStep, activeCategoryHasSubcategories]);

  const loadWorktimes = useCallback(async () => {
    const isFreeOps = isFreeOpsCategoryKey(activeCategoryKey);

    // NOTE: Free operations are editable by all authenticated users.
    // We load them from a dedicated endpoint without the worktimes module permission gate.
    const url = isFreeOps
      ? `${getApiBaseUrl()}/worktimes/free_ops?vehicle_type=${encodeURIComponent(vehicleTypeFilter)}`
      : `${getApiBaseUrl()}/worktimes?vehicle_type=${encodeURIComponent(vehicleTypeFilter)}`;

    const res = await axios.get(url);
    setWorktimes(res.data);
  }, [vehicleTypeFilter, activeCategoryKey]);

  useEffect(() => {
    loadWorktimes();
  }, [loadWorktimes]);

  useEffect(() => {
    // When vehicle type changes we restart the navigation from the first step.
    const firstCatKey = categories[0]?.key || 'regular';
    setActiveCategoryKey(firstCatKey);
    setActiveSubcategoryKey('');
    setNavStep('category');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleTypeFilter, categories]);

  useEffect(() => {
    // If current category becomes forbidden (permissions changed), snap to first allowed.
    const allowedKeys = new Set((categories || []).map((c) => c.key));
    if (!allowedKeys.size) return;
    if (!allowedKeys.has(activeCategoryKey)) {
      setActiveCategoryKey(categories[0]?.key || 'regular');
      setActiveSubcategoryKey('');
      setNavStep('category');
    }
  }, [categories, activeCategoryKey]);

  useEffect(() => {
    // If the active category has no subcategories, ensure we never land in the subcategory step.
    if (vehicleTypeFilter === 'trailer') return;
    if (navStep !== 'subcategory') return;
    if (!activeCategoryHasSubcategories) {
      setActiveSubcategoryKey('');
      setNavStep('worktimes');
    }
  }, [vehicleTypeFilter, navStep, activeCategoryHasSubcategories]);

  useEffect(() => {
    // Keep a valid subcategory key when on trucks.
    if (vehicleTypeFilter === 'trailer') return;

    const list = getSubcategoriesForCategoryKey(vehicleTypeFilter, activeCategoryKey);
    const keys = new Set(list.map((s) => s.key));
    if (!activeSubcategoryKey) return;
    if (activeSubcategoryKey === '__legacy__') return;
    if (!keys.has(activeSubcategoryKey)) {
      setActiveSubcategoryKey('');
    }
  }, [vehicleTypeFilter, activeCategoryKey, activeSubcategoryKey]);

  async function createWorktime() {
    const isFreeOps = isFreeOpsCategoryKey(form.component_type);

    if (isFreeOps) {
      await axios.post(`${getApiBaseUrl()}/worktimes/free_ops`, {
        title: form.title,
        vehicle_type: form.vehicle_type,
      });
    } else {
      const componentTypeForSave =
        form.vehicle_type === 'truck'
          ? (String(form.subcomponent_type || '').trim() || form.component_type)
          : form.component_type;

      await axios.post(`${getApiBaseUrl()}/worktimes`, {
        title: form.title,
        hours: form.hours,
        component_type: componentTypeForSave,
        vehicle_type: form.vehicle_type,
      });
    }
    // Reset but keep selected vehicle type and default category/subcategory.
    const vt = form.vehicle_type;
    const firstCatKey = getCategoriesForVehicleType(vt)[0]?.key || 'regular';
    const firstSubKey =
      vt === 'truck' ? (getSubcategoriesForCategoryKey(vt, firstCatKey)[0]?.key || '') : '';
    setForm({
      title: "",
      hours: "",
      vehicle_type: vt,
      component_type: firstCatKey,
      subcomponent_type: firstSubKey,
    });
    loadWorktimes();
  }

  async function deleteWorktime(id) {
    const isFreeOps = isFreeOpsCategoryKey(activeCategoryKey);
    const url = isFreeOps
      ? `${getApiBaseUrl()}/worktimes/free_ops/${id}`
      : `${getApiBaseUrl()}/worktimes/${id}`;

    await axios.delete(url);
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
                          const firstSubKey =
                            vt === 'truck'
                              ? (getSubcategoriesForCategoryKey(vt, firstKey)[0]?.key || '')
                              : '';
                          setForm({
                            ...form,
                            vehicle_type: vt,
                            component_type: firstKey,
                            subcomponent_type: firstSubKey,
                          });
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
                        onChange={(e) => {
                          const catKey = e.target.value;
                          const firstSubKey =
                            form.vehicle_type === 'truck'
                              ? (getSubcategoriesForCategoryKey(form.vehicle_type, catKey)[0]?.key || '')
                              : '';
                          setForm({ ...form, component_type: catKey, subcomponent_type: firstSubKey });
                        }}
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

                  {/* Truck subcategory (submenu) */}
                  {form.vehicle_type === 'truck' && !isFreeOpsCategoryKey(form.component_type) ? (
                    <Grid item xs={12}>
                      <FormControl fullWidth variant="outlined">
                        <InputLabel>Подменю</InputLabel>
                        <Select
                          value={form.subcomponent_type}
                          onChange={(e) => setForm({ ...form, subcomponent_type: e.target.value })}
                          label="Подменю"
                        >
                          {getSubcategoriesForCategoryKey(form.vehicle_type, form.component_type).map((sub) => (
                            <MenuItem key={sub.key} value={sub.key}>
                              {sub.no}. {sub.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  ) : null}
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
                      disabled={isFreeOpsCategoryKey(form.component_type)}
                      helperText={
                        isFreeOpsCategoryKey(form.component_type)
                          ? 'За „Свободни Операции“ нормовреме не се изисква (цената се задава при фактуриране).'
                          : ''
                      }
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
                      const firstSubKey =
                        vt === 'truck' ? (getSubcategoriesForCategoryKey(vt, firstKey)[0]?.key || '') : '';
                      setForm({
                        ...form,
                        vehicle_type: vt,
                        component_type: firstKey,
                        subcomponent_type: firstSubKey,
                      });
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
                    onChange={(e) => {
                      const catKey = e.target.value;
                      const firstSubKey =
                        form.vehicle_type === 'truck'
                          ? (getSubcategoriesForCategoryKey(form.vehicle_type, catKey)[0]?.key || '')
                          : '';
                      setForm({ ...form, component_type: catKey, subcomponent_type: firstSubKey });
                    }}
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

              {/* Truck subcategory (submenu) */}
              {form.vehicle_type === 'truck' && !isFreeOpsCategoryKey(form.component_type) ? (
                <Grid item xs={12}>
                  <FormControl fullWidth variant="outlined">
                    <InputLabel>Подменю</InputLabel>
                    <Select
                      value={form.subcomponent_type}
                      onChange={(e) => setForm({ ...form, subcomponent_type: e.target.value })}
                      label="Подменю"
                    >
                      {getSubcategoriesForCategoryKey(form.vehicle_type, form.component_type).map((sub) => (
                        <MenuItem key={sub.key} value={sub.key}>
                          {sub.no}. {sub.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              ) : null}
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
                  disabled={isFreeOpsCategoryKey(form.component_type)}
                  helperText={
                    isFreeOpsCategoryKey(form.component_type)
                      ? 'За „Свободни Операции“ нормовреме не се изисква (цената се задава при фактуриране).'
                      : ''
                  }
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
                    // reset happens via the vehicleTypeFilter effect
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

              {/* Step navigation: Category -> Subcategory -> Worktimes */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 1, pb: 1.25 }}>
                {navStep !== 'category' ? (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      // If the current category has a subcategory step (trucks only), go one step back.
                      // Otherwise (e.g. group 10 "Свободни Операции"), go back directly to category selection.
                      if (
                        navStep === 'worktimes' &&
                        vehicleTypeFilter !== 'trailer' &&
                        activeCategoryHasSubcategories
                      ) {
                        setNavStep('subcategory');
                        return;
                      }
                      // Back to category selection.
                      setNavStep('category');
                      setActiveSubcategoryKey('');
                    }}
                    sx={{ mb: 1 }}
                  >
                    ← Назад
                  </Button>
                ) : null}

                {navStep === 'category' ? (
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
                      return (
                        <Card
                          key={cat.key}
                          variant="outlined"
                          sx={(theme) => ({
                            borderRadius: 2,
                            borderWidth: isActive ? 2 : 1,
                            borderColor: isActive ? theme.palette.primary.main : theme.palette.divider,
                            overflow: 'hidden',
                          })}
                        >
                          <CardActionArea
                            onClick={() => {
                              setActiveCategoryKey(cat.key);
                              if (vehicleTypeFilter === 'trailer') {
                                setNavStep('worktimes');
                                return;
                              }

                              const list = getSubcategoriesForCategoryKey(vehicleTypeFilter, cat.key);
                              const firstSub = list[0]?.key || '';
                              if (!list.length) {
                                setActiveSubcategoryKey('');
                                setNavStep('worktimes');
                                return;
                              }

                              setActiveSubcategoryKey(firstSub);
                              setNavStep('subcategory');
                            }}
                            sx={{ p: 1.25 }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 900 }}>{cat.no}. {cat.label}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                                  {vehicleTypeFilter === 'trailer' ? 'Група' : 'Главна група'}
                                </Typography>
                              </Box>
                              <Chip label={count} size="small" sx={{ fontWeight: 900 }} />
                            </Box>
                          </CardActionArea>
                        </Card>
                      );
                    })}
                  </Box>
                ) : null}

                {navStep === 'subcategory' && vehicleTypeFilter !== 'trailer' ? (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      gap: 1,
                      alignItems: 'stretch',
                    }}
                  >
                    {subcategoriesWithLegacy.map((sub) => {
                      const isActive = activeSubcategoryKey === sub.key;
                      const count = countBySubcategoryKey[sub.key] || 0;
                      return (
                        <Card
                          key={sub.key}
                          variant="outlined"
                          sx={(theme) => ({
                            borderRadius: 2,
                            borderWidth: isActive ? 2 : 1,
                            borderColor: isActive ? theme.palette.primary.main : theme.palette.divider,
                            overflow: 'hidden',
                          })}
                        >
                          <CardActionArea
                            onClick={() => {
                              setActiveSubcategoryKey(sub.key);
                              setNavStep('worktimes');
                            }}
                            sx={{ p: 1.25 }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 900 }} title={sub.label}>
                                  {sub.key === '__legacy__' ? String(sub.label) : `${sub.no}. ${sub.label}`}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                                  Подгрупа
                                </Typography>
                              </Box>
                              <Chip label={count} size="small" sx={{ fontWeight: 900 }} />
                            </Box>
                          </CardActionArea>
                        </Card>
                      );
                    })}
                  </Box>
                ) : null}

                {navStep === 'worktimes' ? (
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                      {vehicleTypeFilter === 'trailer'
                        ? `Група: ${formatCategoryLabel(vehicleTypeFilter, activeCategoryKey)}`
                        : `Група: ${formatCategoryLabel(vehicleTypeFilter, activeCategoryKey)} / Подгрупа: ${
                            activeSubcategoryKey === '__legacy__'
                              ? 'Неразпределени (стар тип)'
                              : activeSubcategoryKey
                          }`}
                    </Typography>
                  </Box>
                ) : null}
              </Box>

              {navStep === 'worktimes' ? (
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
              ) : null}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
