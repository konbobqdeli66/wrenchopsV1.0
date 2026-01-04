import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  Container,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Switch,
  FormControlLabel,
  Grid,
  Alert,
  TextField,
  useMediaQuery,
  Stack
} from "@mui/material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import PersonIcon from "@mui/icons-material/Person";
import DeleteIcon from "@mui/icons-material/Delete";
import SecurityIcon from "@mui/icons-material/Security";
import LinkIcon from "@mui/icons-material/Link";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import { getApiBaseUrl } from "../api";

export default function Admin({ t }) {
  const langCode = (typeof window !== 'undefined' && localStorage.getItem('language')) || 'bg';
  const locale = langCode === 'bg' ? 'bg-BG' : langCode === 'de' ? 'de-DE' : 'en-US';

  // Make dialogs full-screen on phones.
  const fullScreenDialog = useMediaQuery('(max-width:600px)');

  const clientsXlsxInputRef = useRef(null);
  const worktimesXlsxInputRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [userPermissions, setUserPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [invitationDialogOpen, setInvitationDialogOpen] = useState(false);
  const [newInvitation, setNewInvitation] = useState(null);
  const [invitationEmail, setInvitationEmail] = useState("");

  const [resetEmail, setResetEmail] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [newResetLink, setNewResetLink] = useState(null);

  const [companySettings, setCompanySettings] = useState({
    app_brand_name: 'Truck Service',
    app_tagline_short: '',
    app_tagline_secondary: '',
    app_brand_font: 'Roboto',
    app_brand_font_size: 22,
    login_show_branding: 1,
    login_gradient: 'pink',
    public_app_url: '',
    company_name: '',
    eik: '',
    vat_number: '',
    city: '',
    address: '',
    phone: '',
    contact_email: '',
    mol: '',
    bank_name: '',
    bic: '',
    iban: '',
    logo_data_url: '',
    invoice_prefix: '09',
    invoice_pad_length: 8,
    invoice_offset: 0,
    invoice_last_number: 0,
    protocol_pad_length: 10,
    protocol_offset: 0,
    protocol_last_number: 0,
    payment_method: 'Банков път',
    hourly_rate: 100,
    vat_rate: 20,
    eur_rate: 1.95583,
    invoice_prepared_by_name: '',
    price_multiplier_out_of_hours: 1,
    price_multiplier_holiday: 1,
    price_multiplier_out_of_service: 1,
  });
  const [savingCompanySettings, setSavingCompanySettings] = useState(false);

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  };

  const downloadXlsx = async (path, filename) => {
    const res = await axios.get(`${getApiBaseUrl()}${path}`, { responseType: 'blob' });
    downloadBlob(res.data, filename);
  };

  const triggerFilePick = (ref) => {
    if (ref?.current) {
      ref.current.value = '';
      ref.current.click();
    }
  };

  const importXlsx = async ({ path, file }) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await axios.post(`${getApiBaseUrl()}${path}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const data = res.data || {};
    alert(
      `Импорт завърши. Нови: ${data.inserted || 0}, Обновени: ${data.updated || 0}, Пропуснати: ${data.skipped || 0}` +
        (Array.isArray(data.errors) && data.errors.length ? `\n\nПроблеми:\n- ${data.errors.join('\n- ')}` : '')
    );
  };

  const handleLogoFileChange = (file) => {
    if (!file) return;
    const maxBytes = 600 * 1024; // keep it reasonably small for storing in SQLite
    if (file.size > maxBytes) {
      alert(t('fileTooLarge'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setCompanySettings((prev) => ({ ...prev, logo_data_url: dataUrl }));
    };
    reader.onerror = () => {
      alert(t('fileReadError'));
    };
    reader.readAsDataURL(file);
  };

  const modules = [
    { key: 'home', label: t('home') },
    { key: 'clients', label: t('clients') },
    { key: 'orders', label: t('orders') },
    { key: 'worktimes', label: t('worktimes') },
    { key: 'vehicles', label: t('vehicles') },
    { key: 'admin', label: t('admin') },
  ];

  useEffect(() => {
    loadUsers();
    loadInvitations();
    loadCompanySettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCompanySettings() {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${getApiBaseUrl()}/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCompanySettings((prev) => ({ ...prev, ...(res.data || {}) }));
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  }

  async function saveCompanySettings() {
    try {
      setSavingCompanySettings(true);
      const token = localStorage.getItem('token');
      const res = await axios.put(`${getApiBaseUrl()}/admin/settings`, companySettings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCompanySettings((prev) => ({ ...prev, ...(res.data || {}) }));
    } catch (error) {
      console.error('Error saving company settings:', error);
      alert(t('saveCompanySettingsError'));
    } finally {
      setSavingCompanySettings(false);
    }
  }

  async function loadUsers() {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${getApiBaseUrl()}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
    } catch (error) {
      console.error('Error loading users:', error);
      alert(t('loadUsersError'));
    }
  }

  async function loadInvitations() {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${getApiBaseUrl()}/admin/invitations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvitations(res.data);
    } catch (error) {
      console.error('Error loading invitations:', error);
    }
  }

  async function loadUserPermissions(userId) {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${getApiBaseUrl()}/admin/users/${userId}/permissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Ensure all modules have permission entries
      const existingPermissions = res.data;
      const allPermissions = modules.map(module => {
        const existing = existingPermissions.find(p => p.module === module.key);
        return existing || {
          module: module.key,
          can_access_module: 1,
          can_read: 1,
          can_write: 0,
          can_delete: 0
        };
      });

      setUserPermissions(allPermissions);
    } catch (error) {
      console.error('Error loading permissions:', error);
      // Create default permissions for all modules
      const defaultPermissions = modules.map(module => ({
        module: module.key,
        can_read: 1,
        can_write: 0,
        can_delete: 0
      }));
      setUserPermissions(defaultPermissions);
    }
  }

  const handlePermissionsClick = async (user) => {
    setSelectedUser(user);
    await loadUserPermissions(user.id);
    setPermissionsDialogOpen(true);
  };

  const handlePermissionsClose = () => {
    setPermissionsDialogOpen(false);
    setSelectedUser(null);
    setUserPermissions([]);
  };

  const handlePermissionChange = (module, permissionType, value) => {
    setUserPermissions(prev =>
      prev.map(perm =>
        perm.module === module
          ? { ...perm, [permissionType]: value ? 1 : 0 }
          : perm
      )
    );
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${getApiBaseUrl()}/admin/users/${selectedUser.id}/permissions`, {
        permissions: userPermissions
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update users list immediately without alert
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === selectedUser.id
            ? { ...user, permissions_count: userPermissions.length }
            : user
        )
      );

      handlePermissionsClose();
      // No need to reload all users, just update the count
    } catch (error) {
      console.error('Error saving permissions:', error);
      alert(t('savePermissionsError'));
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${getApiBaseUrl()}/admin/users/${userId}/role`, {
        role: newRole
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update user role immediately
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId
            ? { ...user, role: newRole }
            : user
        )
      );
    } catch (error) {
      console.error('Error changing role:', error);
      alert(t('changeRoleError'));
      // Note: We don't revert role change on error since it's a select dropdown
      // The user will need to reload the page to see the correct state
    }
  };

  const handleStatusChange = async (userId, isActive) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${getApiBaseUrl()}/admin/users/${userId}/status`, {
        is_active: isActive
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update user status immediately
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId
            ? { ...user, is_active: isActive ? 1 : 0 }
            : user
        )
      );
    } catch (error) {
      console.error('Error changing status:', error);
      alert(t('changeStatusError'));
      // Revert the change on error
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId
            ? { ...user, is_active: !isActive ? 1 : 0 }
            : user
        )
      );
    }
  };

  const handleDeleteUser = async (userId, nickname) => {
    if (!window.confirm(`${t('deleteUserConfirm')} ${nickname}?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${getApiBaseUrl()}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(t('userDeleted'));
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(t('deleteUserError'));
    }
  };

  async function createInvitation() {
    if (!invitationEmail.trim()) {
      alert(t('invitationEmailRequired'));
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(invitationEmail)) {
      alert(t('pleaseEnterValidEmail'));
      return;
    }

    try {
      const res = await axios.post(`${getApiBaseUrl()}/admin/invitations`, {
        email: invitationEmail
      });

      setNewInvitation(res.data);
      setInvitationDialogOpen(true);
      setInvitationEmail("");
      loadInvitations(); // Reload the invitations list
    } catch (error) {
      console.error('Error creating invitation:', error);
      alert(t('invitationErrorPrefix') + (error.response?.data?.error || error.message));
    }
  }

  async function generatePasswordResetLink() {
    if (!resetEmail.trim()) {
      alert(t('invitationEmailRequired'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resetEmail)) {
      alert(t('pleaseEnterValidEmail'));
      return;
    }

    try {
      const res = await axios.post(`${getApiBaseUrl()}/admin/password-reset-links`, {
        email: resetEmail,
      });

      setNewResetLink(res.data);
      setResetDialogOpen(true);
      setResetEmail('');
    } catch (error) {
      console.error('Error generating password reset link:', error);
      alert((error.response?.data?.error || error.message) + '');
    }
  }

  async function deleteInvitation(invitationId) {
    if (!window.confirm(t('deleteInvitationConfirm'))) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${getApiBaseUrl()}/admin/invitations/${invitationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadInvitations();
    } catch (error) {
      console.error('Error deleting invitation:', error);
      alert(t('deleteInvitationError'));
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert(t('linkCopied'));
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AdminPanelSettingsIcon />
        {t('adminUsersHeading')}
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        {t('adminInfoText')}
      </Alert>

      {/* Company / invoice settings */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('invoiceSettingsHeading')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('invoiceSettingsHint')}
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                {t('brandingSection')}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('appNameInBar')}
                value={companySettings.app_brand_name}
                onChange={(e) => setCompanySettings({ ...companySettings, app_brand_name: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('loginTaglineLine1')}
                value={companySettings.app_tagline_short}
                onChange={(e) => setCompanySettings({ ...companySettings, app_tagline_short: e.target.value })}
                helperText={t('loginTaglineHelp')}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('loginTaglineLine2')}
                value={companySettings.app_tagline_secondary}
                onChange={(e) => setCompanySettings({ ...companySettings, app_tagline_secondary: e.target.value })}
                helperText={t('loginTaglineHelp')}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="app-font-label">{t('fontInBar')}</InputLabel>
                <Select
                  labelId="app-font-label"
                  label={t('fontInBar')}
                  value={companySettings.app_brand_font}
                  onChange={(e) => setCompanySettings({ ...companySettings, app_brand_font: e.target.value })}
                >
                  <MenuItem value="Roboto">Roboto</MenuItem>
                  <MenuItem value="Road Rage">Road Rage</MenuItem>
                  <MenuItem value="Michroma">Michroma</MenuItem>
                  <MenuItem value="Cinzel">Cinzel (Cynatar alt)</MenuItem>
                  <MenuItem value="Arial">Arial</MenuItem>
                  <MenuItem value="Verdana">Verdana</MenuItem>
                  <MenuItem value="Tahoma">Tahoma</MenuItem>
                  <MenuItem value="Trebuchet MS">Trebuchet MS</MenuItem>
                  <MenuItem value="Georgia">Georgia</MenuItem>
                  <MenuItem value="Courier New">Courier New</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="app-font-size-label">{t('fontSizeInBar')}</InputLabel>
                <Select
                  labelId="app-font-size-label"
                  label={t('fontSizeInBar')}
                  value={companySettings.app_brand_font_size}
                  onChange={(e) =>
                    setCompanySettings({ ...companySettings, app_brand_font_size: Number(e.target.value) })
                  }
                >
                  <MenuItem value={18}>{t('sizeSmall')} (18px)</MenuItem>
                  <MenuItem value={22}>{t('sizeMedium')} (22px)</MenuItem>
                  <MenuItem value={26}>{t('sizeLarge')} (26px)</MenuItem>
                  <MenuItem value={30}>{t('sizeVeryLarge')} (30px)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Number(companySettings.login_show_branding) === 1}
                    onChange={(e) =>
                      setCompanySettings({
                        ...companySettings,
                        login_show_branding: e.target.checked ? 1 : 0,
                      })
                    }
                  />
                }
                label={t('showBrandingLoginRegister')}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="login-gradient-label">{t('loginGradient')}</InputLabel>
                <Select
                  labelId="login-gradient-label"
                  label={t('loginGradient')}
                  value={companySettings.login_gradient}
                  onChange={(e) => setCompanySettings({ ...companySettings, login_gradient: e.target.value })}
                >
                  <MenuItem value="pink">Pink</MenuItem>
                  <MenuItem value="cyan">Cyan</MenuItem>
                  <MenuItem value="purple">Purple</MenuItem>
                  <MenuItem value="green">Green</MenuItem>
                  <MenuItem value="orange">Orange</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Публичен адрес на приложението (за линкове в имейли)"
                value={companySettings.public_app_url || ''}
                onChange={(e) => setCompanySettings({ ...companySettings, public_app_url: e.target.value })}
                helperText="Пример: https://viatransport-service.xyz (или app.viatransport-service.xyz). Използва се за покани и възстановяване на парола вместо localhost."
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('companyName')}
                value={companySettings.company_name}
                onChange={(e) => setCompanySettings({ ...companySettings, company_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label={t('eik')}
                value={companySettings.eik}
                onChange={(e) => setCompanySettings({ ...companySettings, eik: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label={t('vatNumber')}
                value={companySettings.vat_number}
                onChange={(e) => setCompanySettings({ ...companySettings, vat_number: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label={t('city')}
                value={companySettings.city}
                onChange={(e) => setCompanySettings({ ...companySettings, city: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label={t('address')}
                value={companySettings.address}
                onChange={(e) => setCompanySettings({ ...companySettings, address: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Телефон (за контакт)"
                value={companySettings.phone}
                onChange={(e) => setCompanySettings({ ...companySettings, phone: e.target.value })}
                helperText="Ще се използва в имейлите към клиентите."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Имейл (за контакт)"
                value={companySettings.contact_email}
                onChange={(e) => setCompanySettings({ ...companySettings, contact_email: e.target.value })}
                helperText="Ще се използва в имейлите към клиентите."
              />
            </Grid>


            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('mol')}
                value={companySettings.mol}
                onChange={(e) => setCompanySettings({ ...companySettings, mol: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Съставил (име във фактури/протоколи)"
                value={companySettings.invoice_prepared_by_name || ''}
                onChange={(e) =>
                  setCompanySettings({ ...companySettings, invoice_prepared_by_name: e.target.value })
                }
                helperText="Ще се показва като „Съставил:“ при печат и в PDF по имейл. Ако е празно, ще се използва името от акаунта." 
              />
            </Grid>

            {/* XLSX import/export */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mt: 1 }}>
                XLSX импорт / експорт
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Шаблоните са „готови формуляри“ – сваляте, попълвате и качвате обратно.
              </Typography>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                <Button
                  variant="outlined"
                  startIcon={<DescriptionIcon />}
                  onClick={() => downloadXlsx('/clients/xlsx/template', 'clients_template.xlsx')}
                >
                  Шаблон Клиенти
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={() => downloadXlsx('/clients/xlsx/export', 'clients_export.xlsx')}
                >
                  Експорт Клиенти
                </Button>
                <Button
                  variant="contained"
                  startIcon={<UploadFileIcon />}
                  onClick={() => triggerFilePick(clientsXlsxInputRef)}
                >
                  Импорт Клиенти
                </Button>
                <input
                  ref={clientsXlsxInputRef}
                  type="file"
                  accept=".xlsx"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    try {
                      await importXlsx({ path: '/clients/xlsx/import', file: e.target.files?.[0] });
                    } catch (err) {
                      alert(err?.response?.data?.error || 'Грешка при импорт на Клиенти (XLSX).');
                    }
                  }}
                />

                <Button
                  variant="outlined"
                  startIcon={<DescriptionIcon />}
                  onClick={() => downloadXlsx('/worktimes/xlsx/template', 'worktimes_template.xlsx')}
                >
                  Шаблон Нормовремена
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={() => downloadXlsx('/worktimes/xlsx/export', 'worktimes_export.xlsx')}
                >
                  Експорт Нормовремена
                </Button>
                <Button
                  variant="contained"
                  startIcon={<UploadFileIcon />}
                  onClick={() => triggerFilePick(worktimesXlsxInputRef)}
                >
                  Импорт Нормовремена
                </Button>
                <input
                  ref={worktimesXlsxInputRef}
                  type="file"
                  accept=".xlsx"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    try {
                      await importXlsx({ path: '/worktimes/xlsx/import', file: e.target.files?.[0] });
                    } catch (err) {
                      alert(err?.response?.data?.error || 'Грешка при импорт на Нормовремена (XLSX).');
                    }
                  }}
                />
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('paymentMethod')}
                value={companySettings.payment_method}
                onChange={(e) => setCompanySettings({ ...companySettings, payment_method: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label={t('bank')}
                value={companySettings.bank_name}
                onChange={(e) => setCompanySettings({ ...companySettings, bank_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="BIC"
                value={companySettings.bic}
                onChange={(e) => setCompanySettings({ ...companySettings, bic: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="IBAN"
                value={companySettings.iban}
                onChange={(e) => setCompanySettings({ ...companySettings, iban: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label={`${t('hourlyRate')} (BGN)`}
                type="number"
                value={companySettings.hourly_rate}
                onChange={(e) => setCompanySettings({ ...companySettings, hourly_rate: Number(e.target.value) })}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mt: 1 }}>
                Коефициенти за фактуриране (множители)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Използват се преди фактуриране чрез отметки. По подразбиране са x1.
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Извън работно време (x)"
                type="number"
                value={companySettings.price_multiplier_out_of_hours}
                onChange={(e) =>
                  setCompanySettings({ ...companySettings, price_multiplier_out_of_hours: Number(e.target.value) })
                }
                inputProps={{ step: '0.01', min: 0 }}
                helperText="Пример: 1.2"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Почивен ден (x)"
                type="number"
                value={companySettings.price_multiplier_holiday}
                onChange={(e) =>
                  setCompanySettings({ ...companySettings, price_multiplier_holiday: Number(e.target.value) })
                }
                inputProps={{ step: '0.01', min: 0 }}
                helperText="Пример: 1.5"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Извън сервиз (x)"
                type="number"
                value={companySettings.price_multiplier_out_of_service}
                onChange={(e) =>
                  setCompanySettings({ ...companySettings, price_multiplier_out_of_service: Number(e.target.value) })
                }
                inputProps={{ step: '0.01', min: 0 }}
                helperText="Пример: 1.3"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Курс EUR (BGN за 1 EUR)"
                type="number"
                value={companySettings.eur_rate}
                onChange={(e) => setCompanySettings({ ...companySettings, eur_rate: Number(e.target.value) })}
                inputProps={{ step: '0.00001', min: 0 }}
                helperText="Пример: 1.95583"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label={`${t('hourlyRate')} (EUR)`}
                value={(
                  (Number(companySettings.hourly_rate) || 0) /
                  (Number(companySettings.eur_rate) || 1.95583)
                ).toFixed(2)}
                InputProps={{ readOnly: true }}
                helperText="Изчислява се автоматично: BGN / EUR курс"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label={`${t('vatRate')} (%)`}
                type="number"
                value={companySettings.vat_rate}
                onChange={(e) => setCompanySettings({ ...companySettings, vat_rate: Number(e.target.value) })}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mt: 1 }}>
                {t('invoiceNumbering')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {t('invoiceNumberingHint')}
              </Typography>
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label={t('invoicePrefix')}
                value={companySettings.invoice_prefix}
                onChange={(e) => setCompanySettings({ ...companySettings, invoice_prefix: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label={t('invoiceLength')}
                type="number"
                value={companySettings.invoice_pad_length}
                onChange={(e) =>
                  setCompanySettings({ ...companySettings, invoice_pad_length: Number(e.target.value) })
                }
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label={t('invoiceLastNo')}
                type="number"
                value={companySettings.invoice_last_number}
                onChange={(e) =>
                  setCompanySettings({ ...companySettings, invoice_last_number: Number(e.target.value) })
                }
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label={t('protocolLength')}
                type="number"
                value={companySettings.protocol_pad_length}
                onChange={(e) =>
                  setCompanySettings({ ...companySettings, protocol_pad_length: Number(e.target.value) })
                }
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label={t('protocolLastNo')}
                type="number"
                value={companySettings.protocol_last_number}
                onChange={(e) =>
                  setCompanySettings({ ...companySettings, protocol_last_number: Number(e.target.value) })
                }
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                {t('logoForDocs')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button variant="outlined" component="label">
                  {t('chooseFile')}
                  <input
                    hidden
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleLogoFileChange(e.target.files?.[0])}
                  />
                </Button>
                <Button
                  variant="text"
                  color="error"
                  onClick={() => setCompanySettings((prev) => ({ ...prev, logo_data_url: '' }))}
                  disabled={!companySettings.logo_data_url}
                >
                  {t('remove')}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  {t('logoRecommendation')}
                </Typography>
              </Box>
              <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                {companySettings.logo_data_url ? (
                  <Box
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      p: 1,
                      width: 120,
                      height: 120,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#fff'
                    }}
                  >
                    <img
                      alt="logo"
                      src={companySettings.logo_data_url}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('noLogoUploaded')}
                  </Typography>
                )}
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  onClick={saveCompanySettings}
                  disabled={savingCompanySettings}
                >
                  {savingCompanySettings ? t('saving') : t('saveSettings')}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('usersRegistered')} ({users.length})
          </Typography>

          {/* Mobile: cards */}
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            <Grid container spacing={2}>
              {users.map((user) => (
                <Grid item xs={12} key={user.id}>
                  <Card variant="outlined">
                    <CardContent sx={{ pb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        {user.role === 'admin' ? <AdminPanelSettingsIcon color="primary" /> : <PersonIcon />}
                        <Typography variant="h6" sx={{ fontWeight: 900 }}>
                          {user.nickname}
                        </Typography>
                        <Chip
                          label={user.role === 'admin' ? t('roleAdmin') : t('roleUser')}
                          size="small"
                          color={user.role === 'admin' ? 'primary' : 'default'}
                          sx={{ ml: 'auto' }}
                        />
                      </Box>

                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                          <Select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            disabled={user.role === 'admin' && users.filter((u) => u.role === 'admin').length === 1}
                          >
                            <MenuItem value="user">{t('roleUser')}</MenuItem>
                            <MenuItem value="admin">{t('roleAdmin')}</MenuItem>
                          </Select>
                        </FormControl>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={user.is_active === 1}
                              onChange={(e) => handleStatusChange(user.id, e.target.checked)}
                              color="primary"
                            />
                          }
                          label={user.is_active === 1 ? t('active') : t('inactive')}
                        />
                      </Box>

                      <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('registeredCol')}: {user.created_at ? new Date(user.created_at).toLocaleDateString(locale) : '-'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t('lastLoginCol')}: {user.last_login ? new Date(user.last_login).toLocaleDateString(locale) : t('never')}
                        </Typography>
                      </Box>

                      <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        <Button size="small" variant="outlined" onClick={() => handlePermissionsClick(user)}>
                          {t('permissionsManage')}
                        </Button>
                        {user.role !== 'admin' && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleDeleteUser(user.id, user.nickname)}
                          >
                            {t('delete')}
                          </Button>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {users.length === 0 && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    {t('noUsers')}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>

          {/* Desktop: table */}
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>{t('userCol')}</strong></TableCell>
                    <TableCell><strong>{t('roleCol')}</strong></TableCell>
                    <TableCell><strong>{t('statusCol')}</strong></TableCell>
                    <TableCell><strong>{t('registeredCol')}</strong></TableCell>
                    <TableCell><strong>{t('lastLoginCol')}</strong></TableCell>
                    <TableCell><strong>{t('permissionsCol')}</strong></TableCell>
                    <TableCell><strong>{t('actionsCol')}</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {user.role === 'admin' ? <AdminPanelSettingsIcon color="primary" /> : <PersonIcon />}
                          <Typography variant="body1" fontWeight="bold">
                            {user.nickname}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <Select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            disabled={user.role === 'admin' && users.filter(u => u.role === 'admin').length === 1}
                          >
                            <MenuItem value="user">{t('roleUser')}</MenuItem>
                            <MenuItem value="admin">{t('roleAdmin')}</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={user.is_active === 1}
                              onChange={(e) => handleStatusChange(user.id, e.target.checked)}
                              color="primary"
                            />
                          }
                          label={user.is_active === 1 ? t('active') : t('inactive')}
                        />
                      </TableCell>
                      <TableCell>
                        {user.created_at ? new Date(user.created_at).toLocaleDateString(locale) : '-'}
                      </TableCell>
                      <TableCell>
                        {user.last_login ? new Date(user.last_login).toLocaleDateString(locale) : t('never')}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${user.permissions_count} ${t('modulesCount')}`}
                          variant="outlined"
                          size="small"
                          onClick={() => handlePermissionsClick(user)}
                          sx={{ cursor: 'pointer' }}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => handlePermissionsClick(user)}
                          color="primary"
                          size="small"
                        >
                          <SecurityIcon />
                        </IconButton>
                        {user.role !== 'admin' && (
                          <IconButton
                            onClick={() => handleDeleteUser(user.id, user.nickname)}
                            color="error"
                            size="small"
                          >
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        {t('noUsers')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </CardContent>
      </Card>

      {/* Invitations Management */}
      <Card sx={{ mt: 4 }}>
        <CardContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('invitationsManage')} ({invitations.length})
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 2 }}>
              <TextField
                label={t('emailAddress')}
                type="email"
                value={invitationEmail}
                onChange={(e) => setInvitationEmail(e.target.value)}
                placeholder="user@example.com"
                sx={{ flex: 1 }}
                size="small"
              />
              <Button
                variant="contained"
                startIcon={<LinkIcon />}
                onClick={createInvitation}
              >
                {t('createInvitation')}
              </Button>
            </Box>
          </Box>


          {/* Mobile: cards */}
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            <Grid container spacing={2}>
              {invitations.map((invitation) => (
                <Grid item xs={12} key={invitation.id}>
                  <Card variant="outlined">
                    <CardContent sx={{ pb: 2 }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 800 }}>
                          {invitation.token.substring(0, 16)}...
                        </Typography>
                        <Chip
                          label={invitation.used ? t('used') : t('activeInvitation')}
                          color={invitation.used ? 'success' : 'primary'}
                          size="small"
                          sx={{ ml: 'auto' }}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {t('createdBy')}: <strong>{invitation.created_by_name}</strong>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('createdAt')}: <strong>{new Date(invitation.created_at).toLocaleDateString(locale)}</strong>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('expiresAt')}: <strong>{new Date(invitation.expires_at).toLocaleDateString(locale)}</strong>
                      </Typography>

                      {!invitation.used && (
                        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                          <Button size="small" color="error" variant="outlined" onClick={() => deleteInvitation(invitation.id)}>
                            {t('delete')}
                          </Button>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {invitations.length === 0 && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    {t('noInvitations')}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>

          {/* Desktop: table */}
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>{t('token')}</strong></TableCell>
                    <TableCell><strong>{t('createdBy')}</strong></TableCell>
                    <TableCell><strong>{t('status')}</strong></TableCell>
                    <TableCell><strong>{t('createdAt')}</strong></TableCell>
                    <TableCell><strong>{t('expiresAt')}</strong></TableCell>
                    <TableCell><strong>{t('actionsCol')}</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {invitation.token.substring(0, 16)}...
                        </Typography>
                      </TableCell>
                      <TableCell>{invitation.created_by_name}</TableCell>
                      <TableCell>
                        <Chip
                          label={invitation.used ? t('used') : t('activeInvitation')}
                          color={invitation.used ? 'success' : 'primary'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(invitation.created_at).toLocaleDateString(locale)}
                      </TableCell>
                      <TableCell>
                        {new Date(invitation.expires_at).toLocaleDateString(locale)}
                      </TableCell>
                      <TableCell>
                        {!invitation.used && (
                          <IconButton
                            onClick={() => deleteInvitation(invitation.id)}
                            color="error"
                            size="small"
                          >
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {invitations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        {t('noInvitations')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </CardContent>
      </Card>

      {/* Password reset link (manual) */}
      <Card sx={{ mt: 4 }}>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Ресет на парола (линк за копиране)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Временно решение при блокиран SMTP: генерирате линк и го изпращате ръчно.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              label={t('emailAddress')}
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="user@example.com"
              sx={{ flex: 1 }}
              size="small"
            />
            <Button variant="contained" startIcon={<LinkIcon />} onClick={generatePasswordResetLink}>
              Генерирай линк
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Password reset link dialog */}
      <Dialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={fullScreenDialog}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinkIcon />
          Линк за ресет на парола
        </DialogTitle>
        <DialogContent>
          {newResetLink && (
            <Box>
              <Typography variant="body2" color="text.secondary">
                Валидност до: {new Date(newResetLink.expires_at).toLocaleString(locale)}
              </Typography>
              <TextField
                fullWidth
                value={newResetLink.reset_url}
                InputProps={{ readOnly: true }}
                sx={{ mt: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => copyToClipboard(newResetLink?.reset_url)}>
            <ContentCopyIcon sx={{ mr: 1 }} />
            {t('copyLink')}
          </Button>
          <Button onClick={() => setResetDialogOpen(false)} variant="contained">
            {t('close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Invitation Dialog */}
      <Dialog
        open={invitationDialogOpen}
        onClose={() => setInvitationDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={fullScreenDialog}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinkIcon />
          {t('newInvitationTitle')}
        </DialogTitle>
        <DialogContent>
          {newInvitation && (
            <Box>
              <Typography variant="body1" gutterBottom>
                {t('copyInvitationHint')}
              </Typography>
              <TextField
                fullWidth
                value={newInvitation.invitation_url}
                InputProps={{
                  readOnly: true,
                }}
                sx={{ mt: 2 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('linkValidUntil')} {new Date(newInvitation.expires_at).toLocaleString(locale)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => copyToClipboard(newInvitation?.invitation_url)}>
            <ContentCopyIcon sx={{ mr: 1 }} />
            {t('copyLink')}
          </Button>
          <Button onClick={() => setInvitationDialogOpen(false)} variant="contained">
            {t('close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog
        open={permissionsDialogOpen}
        onClose={handlePermissionsClose}
        maxWidth="md"
        fullWidth
        fullScreen={fullScreenDialog}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon />
          {t('permissionsManage')} - {selectedUser?.nickname}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('permissionsHelp')}
          </Typography>

          <Grid container spacing={3}>
            {modules.map((module) => {
              const currentPerm = userPermissions.find(p => p.module === module.key) ||
                { module: module.key, can_access_module: 1, can_read: 1, can_write: 0, can_delete: 0 };

              return (
                <Grid item xs={12} key={module.key}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">
                          {module.label}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" color="primary" fontWeight="bold">
                            {t('moduleAccess')}
                          </Typography>
                          <Switch
                            checked={currentPerm.can_access_module === 1}
                            onChange={(e) => handlePermissionChange(module.key, 'can_access_module', e.target.checked)}
                            color="primary"
                          />
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ minWidth: 60 }}>{t('read')}:</Typography>
                          <Switch
                            checked={currentPerm.can_read === 1}
                            onChange={(e) => handlePermissionChange(module.key, 'can_read', e.target.checked)}
                            color="primary"
                            size="small"
                            disabled={currentPerm.can_access_module !== 1}
                          />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ minWidth: 60 }}>{t('write')}:</Typography>
                          <Switch
                            checked={currentPerm.can_write === 1}
                            onChange={(e) => handlePermissionChange(module.key, 'can_write', e.target.checked)}
                            color="secondary"
                            size="small"
                            disabled={currentPerm.can_access_module !== 1}
                          />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ minWidth: 60 }}>{t('deleteAction')}:</Typography>
                          <Switch
                            checked={currentPerm.can_delete === 1}
                            onChange={(e) => handlePermissionChange(module.key, 'can_delete', e.target.checked)}
                            color="error"
                            size="small"
                            disabled={currentPerm.can_access_module !== 1}
                          />
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePermissionsClose}>{t('cancel')}</Button>
          <Button
            onClick={handleSavePermissions}
            variant="contained"
            disabled={loading}
            startIcon={<SecurityIcon />}
          >
            {loading ? t('saving') : t('savePermissions')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
