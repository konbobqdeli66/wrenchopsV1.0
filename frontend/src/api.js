import axios from 'axios';

// API configuration utility
export const getApiBaseUrl = () => {
  // For external access (domain names), use the same hostname but backend port
  // This ensures API calls work from external networks
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // Always use the same hostname with backend port (5000)
    return `http://${hostname}:5000`;
  }
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