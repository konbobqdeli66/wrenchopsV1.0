import React, { useState } from "react";
import {
  Button,
  Typography,
  Box,
  TextField,
  Alert,
  CircularProgress,
  Paper,
  IconButton
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EmailIcon from "@mui/icons-material/Email";
import BuildIcon from "@mui/icons-material/Build";
import { getApiBaseUrl } from "../api";
import { t as i18nT, getStoredLanguage } from "../i18n";

function ForgotPassword() {
  const lang = getStoredLanguage();
  const t = (key) => i18nT(key, lang);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t('pleaseEnterValidEmail'));
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/password-recovery/request-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('resetRequestError'));
        return;
      }

      setMessage(t('resetRequestSuccess'));
      setEmail(""); // Clear the email field
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
            {t('forgotPasswordTitle')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('forgotPasswordSubtitle')}
          </Typography>
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

        <Box component="form" sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label={t('emailAddress')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            variant="outlined"
            sx={{ mb: 3 }}
            disabled={loading}
            placeholder="example@email.com"
          />

          <Button
            variant="contained"
            fullWidth
            onClick={handleSubmit}
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <EmailIcon />}
            disabled={loading || !email.trim()}
            sx={{
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 'bold',
              borderRadius: 2
            }}
          >
            {loading ? t('sending') : t('sendResetLink')}
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          {t('resetRequestInfo')}
        </Typography>
      </Paper>
    </Box>
  );
}

export default ForgotPassword;
