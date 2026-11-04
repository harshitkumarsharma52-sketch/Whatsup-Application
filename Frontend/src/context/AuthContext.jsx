import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setAccessToken, clearAccessToken } from '../services/api';
import { disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessTokenState] = useState(null);
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
        // Try refresh first to obtain an in-memory access token via HTTP-only cookie
        const refreshRes = await api.get('/auth/refresh');
        const { token, user: refreshedUser } = extractAuthData(refreshRes.data);

        if (token) {
          setAccessToken(token);
          if (isMounted) setAccessTokenState(token);
        }

        if (refreshedUser) {
          if (isMounted) setUser(refreshedUser);
        } else {
          // If refresh returned token but not user, fetch /auth/me
          const meRes = await api.get('/auth/me');
          const { user: meUser } = extractAuthData(meRes.data);
          if (isMounted) setUser(meUser || meRes.data);
        }
      } catch (refreshErr) {
        // If refresh fails, try /auth/me directly
        try {
          const meRes = await api.get('/auth/me');
          const { token, user: meUser } = extractAuthData(meRes.data);
          if (token) {
            setAccessToken(token);
            if (isMounted) setAccessTokenState(token);
          }
          if (isMounted) setUser(meUser || meRes.data);
        } catch (meErr) {
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

  const refreshAuth = useCallback(async () => {
    try {
      const response = await api.get('/auth/refresh');
      const { token, user: refreshedUser } = extractAuthData(response.data);
      if (token) {
        setAccessToken(token);
        setAccessTokenState(token);
      }
      if (refreshedUser) {
        setUser(refreshedUser);
      }
      return token;
    } catch (err) {
      clearAccessToken();
      setUser(null);
      setAccessTokenState(null);
      throw err;
    }
  }, []);

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
