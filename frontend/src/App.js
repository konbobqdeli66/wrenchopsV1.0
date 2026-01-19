import React, { useCallback, useMemo, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline, Box, IconButton, useMediaQuery, AppBar, Toolbar, Typography, Chip, Container, FormControl, InputLabel, Select } from "@mui/material";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { getApiBaseUrl } from "./api";
import { BottomNavigation, BottomNavigationAction, Paper, Menu, MenuItem, ListItemIcon, ListItemText, Divider, Dialog, DialogTitle, DialogContent, DialogActions, Button, Drawer, List, ListItem, ListItemButton, ListItemText as MuiListItemText } from "@mui/material";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import BuildIcon from "@mui/icons-material/Build";
import HomeIcon from "@mui/icons-material/Home";
import PeopleIcon from "@mui/icons-material/People";
import AssignmentIcon from "@mui/icons-material/Assignment";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import LanguageIcon from "@mui/icons-material/Language";
import PaletteIcon from "@mui/icons-material/Palette";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";

import { decodeJwtPayload } from "./utils/jwt";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Home from "./pages/Home";
import Clients from "./pages/Clients";
import Orders from "./pages/Orders";
import Worktimes from "./pages/Worktimes";
import Vehicles from "./pages/Vehicles";
import Admin from "./pages/Admin";
import Invoices from "./pages/Invoices";

import { t as translate, LANGUAGES } from "./i18n";

const DEFAULT_BRAND_NAME = 'WrenchOps';
const DEFAULT_TAGLINE_SHORT = 'Operations. Optimized.';
const DEFAULT_TAGLINE_SECONDARY = 'The Operating System for Automotive Workshops';
const DEFAULT_TITLE = `${DEFAULT_BRAND_NAME} — ${DEFAULT_TAGLINE_SHORT} · ${DEFAULT_TAGLINE_SECONDARY}`;

// Auto logout after inactivity
const IDLE_LOGOUT_MS = 12 * 60 * 60 * 1000; // 12 hours
const LAST_ACTIVITY_KEY = 'last_activity_ts';

// Material "build" icon as inline SVG for favicon fallback
const FALLBACK_ICON_SVG_DATA_URL =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">
  <path fill="#111" d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-4.7-2.4-7.1-1.4L9 5.7 5.7 9 1.6 4.9c-1 2.4-.6 5.1 1.4 7.1 1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l1.4-1.4c.4-.4.4-1 0-1.4z"/>
</svg>`
  );

const setDocumentTitle = (title) => {
  if (typeof document === 'undefined') return;
  if (!title) {
    document.title = DEFAULT_TITLE;
    return;
  }
  document.title = title === DEFAULT_BRAND_NAME ? DEFAULT_TITLE : title;
};

const setFavicon = (href) => {
  if (typeof document === 'undefined') return;
  if (!href) return;

  const rels = ['icon', 'shortcut icon'];
  rels.forEach((rel) => {
    let link = document.querySelector(`link[rel='${rel}']`);
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', rel);
      document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  });
};

const drawRoundRect = (ctx, x, y, w, h, r) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

// Create an "app icon" style favicon (rounded square + subtle border + centered logo)
const createFramedFaviconDataUrl = (src) => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No canvas context'));

        // Background (white) + subtle shadow + border
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.22)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
        drawRoundRect(ctx, 4, 4, size - 8, size - 8, 14);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();

        drawRoundRect(ctx, 4, 4, size - 8, size - 8, 14);
        ctx.strokeStyle = 'rgba(0,0,0,0.10)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Logo
        const pad = 14;
        const target = size - pad * 2;
        const scale = Math.min(target / img.width, target / img.height);
        const w = Math.max(1, Math.floor(img.width * scale));
        const h = Math.max(1, Math.floor(img.height * scale));
        const dx = Math.floor((size - w) / 2);
        const dy = Math.floor((size - h) / 2);
        ctx.drawImage(img, dx, dy, w, h);

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load favicon image'));
      img.src = src;
    } catch (e) {
      reject(e);
    }
  });
};

// Helper function to adjust color brightness
const adjustColorBrightness = (color, factor) => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  const newR = Math.min(255, Math.max(0, Math.round(r * (1 + factor))));
  const newG = Math.min(255, Math.max(0, Math.round(g * (1 + factor))));
  const newB = Math.min(255, Math.max(0, Math.round(b * (1 + factor))));

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
};

// Create theme (app-like, more vivid, with gentle motion)
const createAppTheme = (mode, primaryColor = '#1976d2', appBarGradient = 'pink') => {
  const endColorMap = {
    pink: '#ff6b9d',
    cyan: '#4dd0e1',
    purple: '#9c27b0',
    green: '#66bb6a',
    orange: '#ff9800',
  };
  const endColor = endColorMap[appBarGradient] || endColorMap.pink;

  return createTheme({
  palette: {
    mode,
    primary: {
      main: mode === 'dark' ? adjustColorBrightness(primaryColor, 0.3) : primaryColor,
    },
    secondary: {
      main: mode === 'dark' ? '#ff6b9d' : '#d32f2f',
    },
    info: {
      main: mode === 'dark' ? '#4dd0e1' : '#0288d1',
    },
    success: {
      main: mode === 'dark' ? '#66bb6a' : '#2e7d32',
    },
    background: {
      default: mode === 'dark' ? '#0d0d0d' : '#ffffff', // Pure black/white for max contrast
      paper: mode === 'dark' ? '#1a1a1a' : '#f8f8f8', // Higher contrast
    },
    text: {
      primary: mode === 'dark' ? '#ffffff' : '#000000', // Pure white/black
      secondary: mode === 'dark' ? '#cccccc' : '#333333', // Higher contrast secondary
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 14,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: mode === 'dark' ? '#000000' : '#ffffff',
          backgroundAttachment: 'initial',
        },
        '*': {
          scrollBehavior: 'smooth',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: `linear-gradient(90deg, ${mode === 'dark' ? '#000000' : '#ffffff'} 0%, ${
            mode === 'dark' ? adjustColorBrightness(primaryColor, 0.25) : primaryColor
          } 55%, ${endColor} 100%)`,
          color: mode === 'dark' ? '#ffffff' : '#000000',
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
          backdropFilter: 'blur(10px)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '1rem', // Larger text for better readability
          borderRadius: 12,
        },
        contained: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)', // More visible shadows
          '&:hover': {
            boxShadow: '0 4px 8px rgba(0,0,0,0.4)', // Enhanced hover effect
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: mode === 'dark'
            ? '0 4px 8px rgba(0, 0, 0, 0.5)' // Stronger shadows for dark mode
            : '0 4px 8px rgba(0, 0, 0, 0.15)', // More visible shadows for light mode
          border: mode === 'dark' ? '1px solid #333333' : '1px solid #cccccc', // Visible borders
          borderRadius: 18,
          transition: 'transform 180ms ease, box-shadow 180ms ease',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: mode === 'dark' ? '#1a1a1a' : '#ffffff', // Higher contrast
          backgroundImage: 'none', // Remove any background patterns
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          marginInline: 8,
          marginBlock: 4,
          transition: 'background-color 160ms ease, transform 160ms ease',
          '&:hover': {
            transform: 'translateX(2px)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: mode === 'dark' ? '#262626' : '#ffffff', // Higher contrast
            '& fieldset': {
              borderColor: mode === 'dark' ? '#555555' : '#999999', // More visible borders
              borderWidth: '2px', // Thicker borders
            },
            '&:hover fieldset': {
              borderColor: primaryColor,
              borderWidth: '2px',
            },
            '&.Mui-focused fieldset': {
              borderColor: primaryColor,
              borderWidth: '3px', // Even thicker when focused
            },
          },
          '& .MuiInputLabel-root': {
            color: mode === 'dark' ? '#cccccc' : '#333333', // Higher contrast labels
            fontWeight: 600,
          },
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          backgroundColor: mode === 'dark' ? '#1a1a1a' : '#ffffff',
          borderTop: mode === 'dark' ? '2px solid #333333' : '2px solid #cccccc', // Visible top border
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          color: mode === 'dark' ? '#ffffff' : '#000000', // Pure colors for max contrast
          '&.Mui-selected': {
            color: primaryColor,
            fontWeight: 'bold',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: mode === 'dark' ? '1px solid #333333' : '1px solid #cccccc', // Visible table borders
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: mode === 'dark' ? '#555555' : '#999999', // More visible dividers
        },
      },
    },
  },
});
};

// Page index -> permission module key mapping.
// Invoices have their own permission module.
const PAGE_MODULES = ['home', 'clients', 'orders', 'worktimes', 'vehicles', 'invoices', 'admin'];

// Главен интерфейс след login
function MainApp() {
  const [page, setPage] = useState(0);
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const isMobile = useMediaQuery('(max-width:768px)');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : prefersDarkMode;
  });
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('language');
    return saved || 'bg';
  });
  const [primaryColor, setPrimaryColor] = useState(() => {
    const saved = localStorage.getItem('primaryColor');
    return saved || '#1976d2';
  });
  const [appBarGradient, setAppBarGradient] = useState(() => {
    const saved = localStorage.getItem('appBarGradient');
    return saved || 'pink';
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const [languageAnchorEl, setLanguageAnchorEl] = useState(null);
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const [userRole, setUserRole] = useState('user');
  const [userNickname, setUserNickname] = useState('');
  const [userPermissions, setUserPermissions] = useState([]);
  const [brandName, setBrandName] = useState(DEFAULT_BRAND_NAME);
  const [brandFont, setBrandFont] = useState('Roboto');
  const [brandLogoDataUrl, setBrandLogoDataUrl] = useState('');
  const [brandFontSize, setBrandFontSize] = useState(22);
  const open = Boolean(anchorEl);
  const languageOpen = Boolean(languageAnchorEl);

  const theme = useMemo(
    () => createAppTheme(darkMode ? 'dark' : 'light', primaryColor, appBarGradient),
    [darkMode, primaryColor, appBarGradient]
  );

  // Translation function
  const t = (key) => translate(key, language);

  const forceLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    window.location.href = '/login';
  }, []);

  // Auto-logout on inactivity (12 hours)
  useEffect(() => {
    // MainApp is rendered only when a token exists, but keep the guard anyway.
    const token = localStorage.getItem('token');
    if (!token) return;

    // Reset idle timer at app start to avoid stale timestamps from previous sessions.
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));

    let lastWrite = 0;
    const recordActivity = () => {
      const now = Date.now();
      // Throttle writes to localStorage (avoid spamming on mousemove)
      if (now - lastWrite < 60 * 1000) return;
      lastWrite = now;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    };

    const checkIdle = () => {
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
      if (!last) return;
      const now = Date.now();
      if (now - last >= IDLE_LOGOUT_MS) {
        forceLogout();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((ev) => window.addEventListener(ev, recordActivity, { passive: true }));

    const interval = setInterval(checkIdle, 60 * 1000);

    // Keep multiple tabs in sync
    const onStorage = (e) => {
      if (e.key === LAST_ACTIVITY_KEY || e.key === 'token') {
        checkIdle();
      }
    };
    window.addEventListener('storage', onStorage);

    // Initial check
    checkIdle();

    return () => {
      clearInterval(interval);
      events.forEach((ev) => window.removeEventListener(ev, recordActivity));
      window.removeEventListener('storage', onStorage);
    };
  }, [forceLogout]);

  // Save preferences to backend
  const savePreferencesToBackend = async (prefs) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      await fetch(`${getApiBaseUrl()}/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(prefs)
      });
    } catch (error) {
      console.log('Could not save preferences to backend');
    }
  };

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    localStorage.setItem('language', language);
    localStorage.setItem('primaryColor', primaryColor);
    localStorage.setItem('appBarGradient', appBarGradient);
    savePreferencesToBackend({
      dark_mode: darkMode,
      language,
      primary_color: primaryColor,
      appbar_gradient: appBarGradient,
    });
  }, [darkMode, language, primaryColor, appBarGradient]);

  // Decode user role from JWT token and load permissions
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = decodeJwtPayload(token);
        if (!payload) throw new Error('Invalid token');
        setUserRole(payload.role || 'user');
        setUserNickname(payload.nickname || '');

        // Load company settings for branding (logo + app title + font)
        fetch(`${getApiBaseUrl()}/preferences/company`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then((r) => {
            if (r.status === 401) {
              forceLogout();
              return null;
            }
            return r.ok ? r.json() : null;
          })
          .then((settings) => {
            if (!settings) return;
            setBrandLogoDataUrl(settings.logo_data_url || '');
            setBrandName(settings.app_brand_name || DEFAULT_BRAND_NAME);
            setBrandFont(settings.app_brand_font || 'Roboto');
            setBrandFontSize(Number(settings.app_brand_font_size) || 22);
          })
          .catch(() => null);

        // Load user permissions
        // NOTE: backend mounts auth routes under /api/auth
        fetch(`${getApiBaseUrl()}/api/auth/permissions`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => {
            if (res.status === 401) {
              forceLogout();
              throw new Error('Unauthorized');
            }
            if (!res.ok) throw new Error(`Failed to load permissions: ${res.status}`);
            return res.json();
          })
          .then(permissions => {
            setUserPermissions(permissions);
          })
          .catch(error => {
            console.error('Error loading permissions:', error);
            setUserPermissions([]);
          });
      } catch (error) {
        console.error('Error decoding token:', error);
        setUserRole('user');
        setUserNickname('');
        setUserPermissions([]);
      }
    }
  }, [forceLogout]);

  // Sync browser tab title + favicon with branding (same as top bar)
  useEffect(() => {
    setDocumentTitle(brandName || DEFAULT_BRAND_NAME);
    const src = brandLogoDataUrl || FALLBACK_ICON_SVG_DATA_URL;
    (async () => {
      try {
        const framed = await createFramedFaviconDataUrl(src);
        setFavicon(framed);
      } catch {
        // Fallback to raw logo/svg
        setFavicon(src);
      }
    })();
  }, [brandName, brandLogoDataUrl]);

  const languages = LANGUAGES;

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLanguageMenuClick = (event) => {
    setLanguageAnchorEl(event.currentTarget);
  };

  const handleLanguageMenuClose = () => {
    setLanguageAnchorEl(null);
  };

  const handleLanguageChange = (langCode) => {
    setLanguage(langCode);
    handleLanguageMenuClose();
    handleMenuClose();
  };

  const handleLogout = () => {
    forceLogout();
  };

  const handleColorDialogOpen = () => {
    setColorDialogOpen(true);
    handleMenuClose();
  };

  const handleColorDialogClose = () => {
    setColorDialogOpen(false);
  };

  const handleColorChange = (event) => {
    setPrimaryColor(event.target.value);
  };

  const allNavigationItems = [
    { label: t('home'), icon: <HomeIcon />, page: 0, module: 'home' },
    { label: t('clients'), icon: <PeopleIcon />, page: 1, module: 'clients' },
    { label: t('orders'), icon: <AssignmentIcon />, page: 2, module: 'orders' },
    { label: t('worktimes'), icon: <AccessTimeIcon />, page: 3, module: 'worktimes' },
    { label: t('vehicles'), icon: <DirectionsCarIcon />, page: 4, module: 'vehicles' },
    { label: t('invoices'), icon: <ReceiptLongIcon />, page: 5, module: 'invoices' },
    ...(userRole === 'admin' ? [{ label: t('admin'), icon: <AdminPanelSettingsIcon />, page: 6, module: 'admin' }] : [])
  ];

  // Always show all tabs, but disable access based on permissions.
  // New users (by default) will see tabs in a disabled/greyscale state until an admin grants access.
  const canAccessModule = useCallback(
    (moduleKey) => {
      if (userRole === 'admin') return true;
      const perms = Array.isArray(userPermissions) ? userPermissions : [];
      const p = perms.find((x) => x.module === moduleKey);
      // Safe default: allow Home while permissions are still loading.
      if (!p) return moduleKey === 'home';
      return Number(p.can_access_module) === 1 && Number(p.can_read) === 1;
    },
    [userRole, userPermissions]
  );

  // Separate permission for deleting invoice document numbers (order_documents).
  const canDeleteInvoices = useMemo(() => {
    if (userRole === 'admin') return true;
    const perms = Array.isArray(userPermissions) ? userPermissions : [];
    const p = perms.find((x) => x.module === 'invoices');
    if (!p) return false;
    return Number(p.can_access_module) === 1 && Number(p.can_delete) === 1;
  }, [userRole, userPermissions]);

  // Hide tabs completely when the user does not have access.
  // (Admin always sees everything via canAccessModule().)
  const navigationItems = allNavigationItems.filter((item) => canAccessModule(item.module));

  // If access is revoked while the app is open, fall back to Home.
  useEffect(() => {
    if (userRole === 'admin') return;
    const moduleKey = PAGE_MODULES[page] || 'home';
    if (!canAccessModule(moduleKey)) {
      setPage(0);
    }
  }, [userRole, userPermissions, page, canAccessModule]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: 'flex' }}>
          {/* TOP APP BAR (hidden on mobile) */}
          {!isMobile && (
          <AppBar position="fixed">
            <Toolbar sx={{ gap: 1 }}>
              {brandLogoDataUrl ? (
                <Box
                  sx={{
                    height: 44,
                    width: 44,
                    borderRadius: 12,
                    p: 0.5,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                    border: darkMode ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(0,0,0,0.10)',
                    boxShadow: darkMode
                      ? '0 6px 16px rgba(0,0,0,0.35)'
                      : '0 6px 16px rgba(0,0,0,0.18)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <Box
                    component="img"
                    src={brandLogoDataUrl}
                    alt="logo"
                    sx={{
                      height: 34,
                      width: 34,
                      objectFit: 'contain',
                      filter: darkMode ? 'invert(1)' : 'none',
                    }}
                  />
                </Box>
              ) : (
                <Box
                  sx={{
                    height: 44,
                    width: 44,
                    borderRadius: 12,
                    p: 0.5,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                    border: darkMode ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(0,0,0,0.10)',
                    boxShadow: darkMode
                      ? '0 6px 16px rgba(0,0,0,0.35)'
                      : '0 6px 16px rgba(0,0,0,0.18)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <BuildIcon sx={{ fontSize: 26 }} />
                </Box>
              )}
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  letterSpacing: 0.2,
                  userSelect: 'none',
                  fontFamily: brandFont || undefined,
                  fontSize: brandFontSize,
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                  <span>{brandName || DEFAULT_BRAND_NAME}</span>
                  {String(brandName || '').trim() === DEFAULT_BRAND_NAME ? (
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{
                        fontWeight: 700,
                        opacity: 0.9,
                        fontSize: Math.max(11, Math.round((brandFontSize || 22) * 0.45)),
                      }}
                    >
                      {DEFAULT_TAGLINE_SHORT}
                    </Typography>
                  ) : null}
                </Box>
              </Typography>

              <Chip
                size="small"
                label={navigationItems.find((x) => x.page === page)?.label || ''}
                sx={{
                  ml: 1,
                  bgcolor: darkMode ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.10)',
                  color: darkMode ? 'common.white' : 'common.black',
                  fontWeight: 700,
                  display: { xs: 'none', sm: 'inline-flex' },
                }}
              />

              <Box sx={{ flexGrow: 1 }} />

              <Chip
                size="small"
                label={userNickname ? userNickname : (userRole === 'admin' ? 'Admin' : 'User')}
                sx={{
                  bgcolor: darkMode ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.10)',
                  color: darkMode ? 'common.white' : 'common.black',
                  fontWeight: 700,
                  mr: 1,
                  display: { xs: 'none', md: 'inline-flex' },
                }}
              />

              <IconButton
                onClick={handleMenuClick}
                sx={{
                  color: darkMode ? 'common.white' : 'common.black',
                  bgcolor: darkMode ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.10)',
                  '&:hover': { bgcolor: darkMode ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.16)' },
                }}
              >
                <SettingsIcon />
              </IconButton>
            </Toolbar>
          </AppBar>
          )}

          {/* DESKTOP DRAWER */}
          {!isMobile && (
            <Drawer
              variant="permanent"
              sx={{
                width: 240,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                  width: 240,
                  boxSizing: 'border-box',
                  top: 64,
                  height: 'calc(100vh - 64px)',
                },
              }}
            >
              <List sx={{ pt: 2 }}>
                {navigationItems.map((item) => (
                  <ListItem key={item.page} disablePadding>
                    <ListItemButton
                      selected={page === item.page}
                      disabled={!canAccessModule(item.module)}
                      onClick={() => {
                        if (!canAccessModule(item.module)) return;
                        setPage(item.page);
                      }}
                      sx={{
                        filter: canAccessModule(item.module) ? 'none' : 'grayscale(1)',
                        opacity: canAccessModule(item.module) ? 1 : 0.65,
                        '&.Mui-selected': {
                          background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                          color: 'common.white',
                          '&:hover': {
                            filter: 'brightness(1.05)',
                          },
                        },
                      }}
                    >
                      <ListItemIcon sx={{
                        color: page === item.page ? 'common.white' : 'inherit'
                      }}>
                        {item.icon}
                      </ListItemIcon>
                      <MuiListItemText primary={item.label} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Drawer>
          )}

          <Box sx={{ flexGrow: 1, pb: isMobile ? 7 : 0, pt: isMobile ? 2 : 10, minHeight: '100vh' }}>

        {/* SETTINGS BUTTON (mobile) */}
        {isMobile && (
          <IconButton
            onClick={handleMenuClick}
            aria-label="Settings"
            sx={{
              position: 'fixed',
              top: 10,
              right: 10,
              zIndex: 1400,
              color: darkMode ? 'common.white' : 'common.black',
              bgcolor: darkMode ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.85)',
              border: (theme) => `1px solid ${theme.palette.divider}`,
              boxShadow: (theme) =>
                theme.palette.mode === 'dark'
                  ? '0 8px 20px rgba(0,0,0,0.55)'
                  : '0 8px 20px rgba(0,0,0,0.20)',
              '&:hover': {
                bgcolor: darkMode ? 'rgba(0,0,0,0.50)' : 'rgba(255,255,255,0.98)',
              },
            }}
          >
            <SettingsIcon />
          </IconButton>
        )}

        {/* SETTINGS MENU */}
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          {/* MOBILE: allow switching tabs (pages) from the settings dropdown */}
          {isMobile && (
            <>
              {navigationItems.map((item) => (
                (() => {
                  const enabled = canAccessModule(item.module);
                  return (
                <MenuItem
                  key={`nav-${item.page}`}
                  selected={page === item.page}
                  disabled={!enabled}
                  onClick={() => {
                    if (!enabled) return;
                    setPage(item.page);
                    handleMenuClose();
                  }}
                  sx={{
                    filter: enabled ? 'none' : 'grayscale(1)',
                    opacity: enabled ? 1 : 0.65,
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText>{item.label}</ListItemText>
                </MenuItem>
                  );
                })()
              ))}

              <Divider />
            </>
          )}

          <MenuItem>
            <ListItemIcon>
              {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
            </ListItemIcon>
            <ListItemText primary={darkMode ? t('darkMode') : t('lightMode')} />
            <FormControlLabel
              control={
                <Switch
                  checked={darkMode}
                  onChange={(e) => setDarkMode(e.target.checked)}
                  color="primary"
                />
              }
              label=""
              sx={{ ml: 1 }}
            />
          </MenuItem>

          <MenuItem onClick={handleLanguageMenuClick}>
            <ListItemIcon>
              <LanguageIcon />
            </ListItemIcon>
            <ListItemText>
              {t('language')}: {languages.find(lang => lang.code === language)?.flag} {languages.find(lang => lang.code === language)?.name}
            </ListItemText>
            <ArrowRightIcon />
          </MenuItem>

          <MenuItem onClick={handleColorDialogOpen}>
            <ListItemIcon>
              <PaletteIcon />
            </ListItemIcon>
            <ListItemText>{t('personalization')}</ListItemText>
          </MenuItem>

          <Divider />

          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText>{t('logout')}</ListItemText>
          </MenuItem>
        </Menu>

        {/* LANGUAGE SUBMENU */}
        <Menu
          anchorEl={languageAnchorEl}
          open={languageOpen}
          onClose={handleLanguageMenuClose}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
        >
          {languages.map((lang) => (
            <MenuItem
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              selected={language === lang.code}
            >
              <ListItemText>
                {lang.flag} {lang.name}
              </ListItemText>
            </MenuItem>
          ))}
        </Menu>

        {/* COLOR CUSTOMIZATION DIALOG */}
        <Dialog open={colorDialogOpen} onClose={handleColorDialogClose} maxWidth="sm" fullWidth>
          <DialogTitle>{t('personalizationTitle')}</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography gutterBottom>{t('primaryColor')}</Typography>
              <FormControl fullWidth>
                <InputLabel id="primary-color-label">{t('color')}</InputLabel>
                <Select
                  labelId="primary-color-label"
                  label={t('color')}
                  value={primaryColor}
                  onChange={handleColorChange}
                >
                  <MenuItem value="#1976d2">Син (по подразбиране)</MenuItem>
                  <MenuItem value="#0ea5e9">Светло син</MenuItem>
                  <MenuItem value="#16a34a">Зелен</MenuItem>
                  <MenuItem value="#f59e0b">Оранжев</MenuItem>
                  <MenuItem value="#ef4444">Червен</MenuItem>
                  <MenuItem value="#a855f7">Лилав</MenuItem>
                  <MenuItem value="#14b8a6">Тюркоаз</MenuItem>
                  <MenuItem value="#111827">Тъмно (графит)</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('chooseAccentColorHelp')}
              </Typography>
            </Box>

            <Box sx={{ mt: 3 }}>
              <FormControl fullWidth>
                <InputLabel id="appbar-gradient-label">{t('appbarGradient')}</InputLabel>
                <Select
                  labelId="appbar-gradient-label"
                  label={t('appbarGradient')}
                  value={appBarGradient}
                  onChange={(e) => setAppBarGradient(e.target.value)}
                >
                  <MenuItem value="pink">Pink</MenuItem>
                  <MenuItem value="cyan">Cyan</MenuItem>
                  <MenuItem value="purple">Purple</MenuItem>
                  <MenuItem value="green">Green</MenuItem>
                  <MenuItem value="orange">Orange</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {darkMode ? t('gradientHelpDark') : t('gradientHelpLight')}
              </Typography>
            </Box>

            {/* „Съставил“ се настройва от Admin панела (Company settings) */}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleColorDialogClose}>{t('close')}</Button>
          </DialogActions>
        </Dialog>

        {/* PAGE CONTENT */}
        <Container maxWidth="xl" sx={{ py: 2 }}>
          {page === 0 && <Home setPage={setPage} t={t} />}
          {page === 1 && <Clients setPage={setPage} t={t} />}
          {page === 2 && <Orders t={t} />}
          {page === 3 && <Worktimes t={t} />}
          {page === 4 && <Vehicles setPage={setPage} t={t} />}
          {page === 5 && <Invoices t={t} canDeleteInvoices={canDeleteInvoices} />}
          {page === 6 && userRole === 'admin' && <Admin t={t} />}
        </Container>

            {/* BOTTOM NAVIGATION - MOBILE ONLY */}
            {isMobile && (
              <Paper
                sx={{ position: "fixed", bottom: 0, left: 0, right: 0 }}
                elevation={3}
              >
                <BottomNavigation
                  showLabels
                  value={page}
                  onChange={(event, newValue) => {
                    const nextItem = navigationItems.find((x) => x.page === newValue);
                    if (nextItem && !canAccessModule(nextItem.module)) return;
                    setPage(newValue);
                  }}
                  sx={{
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    flexWrap: 'nowrap',
                    justifyContent: 'flex-start',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                    '&::-webkit-scrollbar': { display: 'none' },
                  }}
                >
                  {navigationItems.map((item) => {
                    const enabled = canAccessModule(item.module);
                    return (
                    <BottomNavigationAction
                      key={item.page}
                      value={item.page}
                      label={item.label}
                      icon={item.icon}
                      disabled={!enabled}
                      sx={{
                        flex: '0 0 auto',
                        minWidth: 96,
                        maxWidth: 160,
                        filter: enabled ? 'none' : 'grayscale(1)',
                        opacity: enabled ? 1 : 0.65,
                      }}
                    />
                    );
                  })}
                </BottomNavigation>
              </Paper>
            )}
          </Box>
        </Box>
      </ThemeProvider>
    </LocalizationProvider>
  );
}

// Основен App Router
function App() {
  const token = localStorage.getItem("token"); // проверка дали има логнат потребител

  return (
    <BrowserRouter>
      <Routes>
        {/* LOGIN */}
        <Route path="/login" element={token ? <Navigate to="/" /> : <Login />} />

        {/* REGISTER */}
        <Route path="/register" element={token ? <Navigate to="/" /> : <Register />} />

        {/* FORGOT PASSWORD */}
        <Route path="/forgot-password" element={token ? <Navigate to="/" /> : <ForgotPassword />} />

        {/* RESET PASSWORD */}
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Защитена зона */}
        <Route path="/" element={token ? <MainApp /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
