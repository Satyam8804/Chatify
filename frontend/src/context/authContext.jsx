import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import axios from "axios";
import api, { setToken, clearToken } from "../api/axios";
import { logger } from "../utils/logger";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── Restore Session on App Boot ──────────────────────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // 1️⃣ Exchange httpOnly refresh cookie → fresh access token
        const { data: refreshData } = await axios.post(
          `${import.meta.env.VITE_API_URL}/users/refresh-token`,
          {},
          { withCredentials: true }
        );

        setToken(refreshData.accessToken); // ✅ memory only

        // 2️⃣ Fetch user profile with the new access token
        const { data: userData } = await api.get("/users/me");
        setUser(userData.user);
      } catch (error) {
        logger(error.message);
        clearToken();
        setUser(null);
      } finally {
        setLoading(false); // ✅ always unblock the UI
      }
    };

    restoreSession();
  }, []);

  // ─── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (credentials) => {
    try {
      const { data } = await api.post("/users/login-user", credentials);
      setToken(data.accessToken);
      setUser(data.user);
    } catch (error) {
      logger(error);
      throw error; // ✅ re-throw so login form can react
    }
  }, []);

  // ─── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await api.post("/users/logout");
    } catch (error) {
      logger("Logout error:", error);
    } finally {
      clearToken();
      setUser(null); // ✅ always clear locally even if API fails
    }
  }, []);

  // ─── Refresh User Profile ──────────────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get("/users/me");
      setUser(data.user);
    } catch (error) {
      logger(error);
    }
  }, []);

  // ─── Context Value ─────────────────────────────────────────────────────────
  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      loading,
      login,
      logout,
      refreshUser,
    }),
    [user, loading, login, logout, refreshUser] // ✅ complete deps
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
