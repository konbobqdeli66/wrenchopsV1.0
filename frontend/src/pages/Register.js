import React, { useState, useEffect } from "react";
import {
  Button,
  Typography,
  Box,
  TextField,
  Alert,
  CircularProgress,
  Paper
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import BuildIcon from "@mui/icons-material/Build";
import { getApiBaseUrl } from "../api";
import { t as i18nT, getStoredLanguage } from "../i18n";

const DEFAULT_BRAND_NAME = 'WrenchOps';
const DEFAULT_TAGLINE_SHORT = 'Operations. Optimized.';
const DEFAULT_TAGLINE_SECONDARY = 'The Operating System for Automotive Workshops';

function Register() {
  const lang = getStoredLanguage();
  const t = (key) => i18nT(key, lang);

  const [nickname, setNickname] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [invitationToken, setInvitationToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [branding, setBranding] = useState(null);

  // Get invitation token from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      setInvitationToken(token);
    } else {
      setError(i18nT('invalidRegistrationLink', lang));
    }
  }, [lang]);

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

  const handleRegister = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    // Validation
    if (!nickname.trim()) {
      setError(t('pleaseEnterNickname'));
      setLoading(false);
      return;
    }

    if (!email.trim()) {
      setError(t('pleaseEnterEmail'));
      setLoading(false);
      return;
    }

    if (!firstName.trim()) {
      setError(t('pleaseEnterFirstName'));
      setLoading(false);
      return;
    }

    if (!lastName.trim()) {
      setError(t('pleaseEnterLastName'));
      setLoading(false);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t('pleaseEnterValidEmail'));
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError(t('passwordMin6'));
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError(t('passwordsDontMatch'));
      setLoading(false);
      return;
    }

    try {
      const apiBaseUrl = getApiBaseUrl();

      const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          first_name: firstName,
          last_name: lastName,
          email,
          password,
          invitation_token: invitationToken
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || t('registrationError'));
        return;
      }

      setSuccess(t('registrationSuccess'));
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
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
          {t('registerTitle')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
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
              label={t('firstName')}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              variant="outlined"
              sx={{ mb: 2 }}
              disabled={loading}
            />

            <TextField
              fullWidth
              label={t('lastName')}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              variant="outlined"
              sx={{ mb: 2 }}
              disabled={loading}
            />

            <TextField
              fullWidth
              label={t('email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
             sx={{ mb: 2 }}
             disabled={loading}
           />

           <TextField
             fullWidth
             label={t('confirmPassword')}
             type="password"
             value={confirmPassword}
             onChange={(e) => setConfirmPassword(e.target.value)}
             variant="outlined"
             sx={{ mb: 3 }}
             disabled={loading}
           />

          <Button
            variant="contained"
            fullWidth
            onClick={handleRegister}
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <PersonAddIcon />}
            disabled={loading}
            sx={{
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 'bold',
              borderRadius: 2
            }}
          >
            {loading ? `${t('register')}...` : t('register')}
          </Button>
        </Box>

        <Typography
          variant="body2"
          sx={{
            mt: 3,
            cursor: "pointer",
            color: "primary.main",
            '&:hover': { textDecoration: 'underline' }
          }}
          onClick={() => window.location.href = "/login"}
        >
          {t('alreadyHaveAccount')}
        </Typography>
      </Paper>
    </Box>
  );
}

export default Register;
