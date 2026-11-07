import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setAccessToken, getAccessToken, clearAccessToken } from '../services/api';
import { disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

const readSavedUser = () => {
  try { return JSON.parse(localStorage.getItem('chat_user') || 'null'); } catch { return null; }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => typeof window !== 'undefined' ? readSavedUser() : null);
  const [accessToken, setAccessTokenState] = useState(() => getAccessToken());
  const [isLoading, setIsLoading] = useState(true);

  const extractAuthData = (data) => {
    if (!data) return { token: null, user: null };
    const token =
      data.accessToken ||
      data.token ||
      data.data?.accessToken ||
      data.data?.token ||
      null;
    const user =
      data.user ||
      data.data?.user ||
      (data._id || data.id ? data : null);
    return { token, user };
  };

  // Restore session on mount
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const token = getAccessToken();
        if (!token) return;
        setAccessToken(token);
        if (isMounted) setAccessTokenState(token);
        const meRes = await api.get('/me');
        const { user: meUser } = extractAuthData(meRes.data);
        if (isMounted) setUser(meUser || meRes.data);
      } catch (error) {
        // Do not log somebody out merely because the device is offline or
        // Render is waking up. A definitive 401 is the only automatic logout.
        if (error.response?.status === 401) {
          clearAccessToken();
          if (isMounted) {
            setUser(null);
            setAccessTokenState(null);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  useEffect(() => {
    if (user) localStorage.setItem('chat_user', JSON.stringify(user));
    else localStorage.removeItem('chat_user');
  }, [user]);

  useEffect(() => {
    const handleTokenRefreshed = (event) => {
      const token = event.detail;
      if (token) setAccessTokenState(token);
    };
    const handleSessionExpired = () => {
      clearAccessToken();
      disconnectSocket();
      localStorage.removeItem('chat_user');
      setUser(null);
      setAccessTokenState(null);
    };
    window.addEventListener('auth:token-refreshed', handleTokenRefreshed);
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth:token-refreshed', handleTokenRefreshed);
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    const { token, user: loggedUser } = extractAuthData(response.data);

    if (token) {
      setAccessToken(token);
      setAccessTokenState(token);
    }
    if (loggedUser) {
      setUser(loggedUser);
    }
    return response.data;
  }, []);

  const register = useCallback(async (userData) => {
    const response = await api.post('/auth/register', userData);
    const { token, user: registeredUser } = extractAuthData(response.data);

    if (token) {
      setAccessToken(token);
      setAccessTokenState(token);
    }
    if (registeredUser) {
      setUser(registeredUser);
    }
    return response.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.warn('Logout request failed or server unreachable:', error);
    } finally {
      clearAccessToken();
      disconnectSocket();
      localStorage.removeItem('chat_user');
      setUser(null);
      setAccessTokenState(null);
    }
  }, []);

  const updateUser = useCallback((updatedData) => {
    setUser((prev) => {
      if (!prev) return updatedData;
      return { ...prev, ...updatedData };
    });
  }, []);

  const refreshAuth = useCallback(async () => getAccessToken(), []);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    accessToken,
    login,
    register,
    logout,
    updateUser,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
