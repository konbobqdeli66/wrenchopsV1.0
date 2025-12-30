import React, { useEffect, useState } from "react";
import {
  Button,
  Typography,
  Box,
  TextField,
  Alert,
  CircularProgress,
  Paper
} from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import BuildIcon from "@mui/icons-material/Build";
import { getApiBaseUrl } from "../api";
import { t as i18nT, getStoredLanguage } from "../i18n";

const DEFAULT_BRAND_NAME = 'WrenchOps';
const DEFAULT_TAGLINE_SHORT = 'Operations. Optimized.';
const DEFAULT_TAGLINE_SECONDARY = 'The Operating System for Automotive Workshops';

function Login() {
  const lang = getStoredLanguage();
  const t = (key) => i18nT(key, lang);

  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [branding, setBranding] = useState(null);

  useEffect(() => {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    fetch(`${getApiBaseUrl()}/public/branding`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setBranding({ ...data, _prefersDark: prefersDark });
      })
      .catch(() => null);
  }, []);

  const gradientEndMap = {
    pink: '#ff6b9d',
    cyan: '#4dd0e1',
    purple: '#9c27b0',
    green: '#66bb6a',
    orange: '#ff9800',
  };
  const loginEnd = gradientEndMap[branding?.login_gradient] || gradientEndMap.pink;
  const loginStart = branding?._prefersDark ? '#000000' : '#ffffff';
  const loginMid = '#1976d2';
  const loginText = branding?._prefersDark ? '#ffffff' : '#000000';
  const showBranding = Number(branding?.login_show_branding) === 1;
  const taglineShort = String(branding?.app_tagline_short || '').trim() || DEFAULT_TAGLINE_SHORT;
  const taglineSecondary = String(branding?.app_tagline_secondary || '').trim() || DEFAULT_TAGLINE_SECONDARY;

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      const apiBaseUrl = getApiBaseUrl();

      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || t('loginError'));
        return;
      }

      localStorage.setItem("token", data.token);

      // Load user preferences
      try {
        const prefsResponse = await fetch(`${getApiBaseUrl()}/preferences`, {
          headers: {
            'Authorization': `Bearer ${data.token}`
          }
        });

          if (prefsResponse.ok) {
            const preferences = await prefsResponse.json();
            localStorage.setItem('darkMode', JSON.stringify(preferences.dark_mode === 1));
            localStorage.setItem('language', preferences.language);
            localStorage.setItem('primaryColor', preferences.primary_color);
            localStorage.setItem('appBarGradient', preferences.appbar_gradient || 'pink');
          }
        } catch (error) {
          console.log('Could not load preferences, using defaults');
        }

      window.location.reload(); // пренасочване към главното приложение с новите настройки
    } catch (error) {
      setError(t('serverError'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #000000 0%, #111827 100%)',
        p: 2
      }}
    >
      <Paper
        elevation={10}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 400,
          borderRadius: 3,
          textAlign: 'center'
        }}
      >
        <Box sx={{ mb: 3 }}>
          {showBranding ? (
            <Box
              sx={{
                borderRadius: 2,
                px: 2,
                py: 1.5,
                background: `linear-gradient(90deg, ${loginStart} 0%, ${loginMid} 55%, ${loginEnd} 100%)`,
                color: loginText,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.25,
              }}
            >
              {branding?.logo_data_url ? (
                <Box
                  component="img"
                  src={branding.logo_data_url}
                  alt="logo"
                  sx={{
                    height: 44,
                    width: 44,
                    objectFit: 'contain',
                    filter: branding?._prefersDark ? 'invert(1)' : 'none',
                  }}
                />
              ) : (
                <BuildIcon sx={{ fontSize: 44, color: loginText }} />
              )}
              <Typography
                component="div"
                sx={{
                  fontWeight: 900,
                  fontFamily: branding?.app_brand_font || 'Roboto',
                  fontSize: Number(branding?.app_brand_font_size) || 22,
                  lineHeight: 1,
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
                  <span>{branding?.app_brand_name || DEFAULT_BRAND_NAME}</span>
                  <Typography component="span" variant="caption" sx={{ fontWeight: 800, opacity: 0.95 }}>
                    {taglineShort}
                  </Typography>
                  <Typography component="span" variant="caption" sx={{ fontWeight: 700, opacity: 0.9 }}>
                    {taglineSecondary}
                  </Typography>
                </Box>
              </Typography>
            </Box>
          ) : (
            <>
              <BuildIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
              <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
                {t('authWorkshop')}
              </Typography>
              <Typography variant="h6" color="text.secondary">
                {t('authSystem')}
              </Typography>
            </>
          )}
        </Box>

        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
          {t('loginTitle')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label={t('nickname')}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            variant="outlined"
            sx={{ mb: 2 }}
            disabled={loading}
          />

          <TextField
            fullWidth
            label={t('password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            variant="outlined"
            sx={{ mb: 3 }}
            disabled={loading}
          />

          <Button
            variant="contained"
            fullWidth
            onClick={handleLogin}
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <LoginIcon />}
            disabled={loading}
            sx={{
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 'bold',
              borderRadius: 2
            }}
          >
            {loading ? `${t('login')}...` : t('login')}
          </Button>
        </Box>

        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography
            variant="body2"
            sx={{
              cursor: "pointer",
              color: "primary.main",
              '&:hover': { textDecoration: 'underline' }
            }}
            onClick={() => window.location.href = "/forgot-password"}
          >
            {t('forgotPassword')}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              cursor: "pointer",
              color: "primary.main",
              '&:hover': { textDecoration: 'underline' }
            }}
            onClick={() => window.location.href = "/register"}
          >
            {t('noAccountRegister')}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

export default Login;
