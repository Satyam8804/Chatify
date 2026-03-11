import { createContext, useContext, useEffect, useState, useMemo } from "react";
import axios from "axios";
import api, { setToken, clearToken } from "../api/axios";
import { logger } from "../utils/logger";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        // ✅ First get a fresh access token via refresh token (httpOnly cookie)
        const refreshRes = await axios.post(
          `${import.meta.env.VITE_API_URL}/users/refresh-token`,
          {},
          { withCredentials: true }
        );

        setToken(refreshRes.data.accessToken); // ✅ store in memory

        // ✅ Now fetch user with valid token
        const userRes = await api.get("/users/me");
        setUser(userRes.data.user);
      } catch (error) {
        logger(error.message);
        setUser(null);
        clearToken();
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (credentials) => {
    const res = await api.post("/users/login-user", credentials);
    setToken(res.data.accessToken);
    setUser(res.data.user);
  };

  const logout = async () => {
    try {
      await api.post("/users/logout");
    } catch (error) {
      logger("Logout error", error);
    } finally {
      setUser(null);
      clearToken();
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
      isAuthenticated: !!user,
      login,
      logout,
      loading,
      refreshUser,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
