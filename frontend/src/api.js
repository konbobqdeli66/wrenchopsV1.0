import axios from 'axios';

// API configuration utility
export const getApiBaseUrl = () => {
  // 1) Explicit override (works for both dev/prod builds)
  // Example: REACT_APP_API_BASE_URL=https://api.example.com
  const envBase = String(process.env.REACT_APP_API_BASE_URL || '').trim();
  if (envBase) return envBase.replace(/\/+$/, '');

  // 2) Browser runtime: default to same-origin (works with Nginx reverse proxy)
  // - Production setup: https://app.example.com  -> Nginx serves React + proxies /api to backend
  // - Dev setup: http://localhost:3000 -> backend is usually on :5000
  if (typeof window !== 'undefined') {
    const { hostname, port, protocol } = window.location;

    // CRA dev server default: proxy backend on :5000
    if (String(port) === '3000') {
      return `${protocol}//${hostname}:5000`;
    }

    // Any other case: rely on same-origin (Nginx/Reverse-proxy handles backend routes)
    return window.location.origin;
  }

  // 3) Server-side fallback
  return 'http://localhost:5000';
};

export const api = {
  baseUrl: getApiBaseUrl(),
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register'
  },
  clients: '/clients',
  orders: '/orders',
  vehicles: '/vehicles',
  worktimes: '/worktimes',
  preferences: '/preferences'
};

// Axios interceptor to add Authorization header
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
