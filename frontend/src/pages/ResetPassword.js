import React, { useState, useEffect } from "react";
import {
  Button,
  Typography,
  Box,
  TextField,
  Alert,
  CircularProgress,
  Paper,
  IconButton,
  LinearProgress
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LockResetIcon from "@mui/icons-material/LockReset";
import BuildIcon from "@mui/icons-material/Build";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { getApiBaseUrl } from "../api";
import { t as i18nT, getStoredLanguage } from "../i18n";

function ResetPassword() {
  const lang = getStoredLanguage();
  const t = (key) => i18nT(key, lang);

  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tokenValid, setTokenValid] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [resetComplete, setResetComplete] = useState(false);

  useEffect(() => {
    // Get token from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');

    if (!tokenParam) {
      setError(i18nT('invalidResetLink', lang));
      setVerifying(false);
      return;
    }

    setToken(tokenParam);

    // Verify token
    (async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/password-recovery/verify-token/${tokenParam}`);

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || i18nT('invalidOrExpiredToken', lang));
          return;
        }

        const data = await response.json();
        setTokenValid(true);
        setUserInfo(data);
      } catch (error) {
        setError(i18nT('tokenVerificationError', lang));
        console.error(error);
      } finally {
        setVerifying(false);
      }
    })();
  }, [lang]);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    // Validate passwords
    if (!newPassword || !confirmPassword) {
      setError(t('fillAllFields'));
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('passwordsDontMatchNoBang'));
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError(t('passwordMin6NoBang'));
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/password-recovery/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword,
          confirmPassword
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('resetPasswordError'));
        return;
      }

      setMessage(t('resetPasswordSuccess'));
      setResetComplete(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    } catch (error) {
      setError(t('serverError'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="h6">{t('verifyingLink')}</Typography>
          <LinearProgress sx={{ mt: 2 }} />
        </Paper>
      </Box>
    );
  }

  if (resetComplete) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
          <CheckCircleIcon sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            {t('done')}
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {t('passwordResetDone')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('redirectingToLogin')}
          </Typography>
          <LinearProgress sx={{ mt: 2 }} />
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
        {/* Back Button */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton
            onClick={() => window.location.href = "/"}
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="body2" color="text.secondary">
            {t('backToLogin')}
          </Typography>
        </Box>

        <Box sx={{ mb: 3 }}>
          <BuildIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            {t('newPasswordTitle')}
          </Typography>
          {userInfo && (
            <Typography variant="body1" color="text.secondary">
              {t('hello')}, <strong>{userInfo.nickname}</strong>
            </Typography>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {message && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}

        {tokenValid ? (
          <Box component="form" sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label={t('newPassword')}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              variant="outlined"
              sx={{ mb: 2 }}
              disabled={loading}
              helperText={t('min6Chars')}
            />

            <TextField
              fullWidth
              label={t('confirmNewPassword')}
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
              onClick={handleSubmit}
              size="large"
              startIcon={loading ? <CircularProgress size={20} /> : <LockResetIcon />}
              disabled={loading || !newPassword || !confirmPassword}
              sx={{
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 'bold',
                borderRadius: 2
              }}
            >
              {loading ? t('saving') : t('saveNewPassword')}
            </Button>
          </Box>
        ) : (
          <Alert severity="error">
            {t('resetLinkInvalidOrExpired')}
            {` `}
            {t('requestNewResetLink')}
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          {t('resetLinkValidFor1h')}
        </Typography>
      </Paper>
    </Box>
  );
}

export default ResetPassword;
