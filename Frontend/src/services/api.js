import axios from 'axios';
import { API_URL } from './apiUrl';

let memoryToken = null;
let isRefreshing = false;
let failedQueue = [];
let refreshPromise = null;
const baseURL = API_URL;

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export const setAccessToken = (token) => {
  memoryToken = token;
};

export const getAccessToken = () => {
  return memoryToken;
};

export const clearAccessToken = () => {
  memoryToken = null;
};

export const refreshAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = axios.get(`${baseURL}/auth/refresh`, { withCredentials: true })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

const notifyAuthEvent = (name, detail) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail }));
};

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    if (memoryToken) {
      config.headers['Authorization'] = `Bearer ${memoryToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (!error.response) {
      return Promise.reject(error);
    }

    const isAuthRoute =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/me');

    if (error.response.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Refresh token request via cookie
        const refreshResponse = await refreshAccessToken();

        const newToken =
          refreshResponse.data?.accessToken ||
          refreshResponse.data?.data?.accessToken ||
          refreshResponse.data?.token;

        if (newToken) {
          setAccessToken(newToken);
          notifyAuthEvent('auth:token-refreshed', newToken);
          processQueue(null, newToken);
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return api(originalRequest);
        } else {
          throw new Error('No new token provided by refresh endpoint');
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAccessToken();
        notifyAuthEvent('auth:session-expired');
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
