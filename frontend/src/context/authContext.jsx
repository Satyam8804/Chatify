import { createContext, useContext, useEffect, useState, useMemo } from "react";

import api from "../api/axios";
import { logger } from "../utils/logger";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const res = await api.get("/users/me");

        setUser(res.data.user);

        if (res.data.accessToken) {
          setAccessToken(res.data.accessToken);
          localStorage.setItem("accessToken", res.data.accessToken);
        }
      } catch (error) {
        logger(error.message);
        setUser(null);
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (credentials) => {
    const res = await api.post("/users/login-user", credentials);
    setAccessToken(res.data.accessToken);
    localStorage.setItem("accessToken", res.data.accessToken);
    setUser(res.data.user);
  };

  const logout = async () => {
    try {
      await api.post("/users/logout");
      localStorage.removeItem("accessToken");
    } catch (error) {
      logger("Logout error", error);
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  };
  const refreshUser = async () => {
    try {
      const res = await api.get("/users/me");
      setUser(res.data.user);
    } catch (error) {
      logger(error);
    }
  };

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isAuthenticated: !!user,
      login,
      logout,
      loading,
      refreshUser,
    }),
    [user, accessToken, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
