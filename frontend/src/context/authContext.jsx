import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import axios from "axios";
import api, { setToken, clearToken, getToken } from "../api/axios";
import { logger } from "../utils/logger";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── Restore Session on App Boot ─────────────────────
  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        let token = getToken();

        // If token already exists, skip refresh request
        if (!token) {
          const { data } = await axios.post(
            `${import.meta.env.VITE_API_URL}/users/refresh-token`,
            {},
            { withCredentials: true }
          );

          token = data.accessToken;
          setToken(token);
        }

        const { data: userData } = await api.get("/users/me");

        if (mounted) setUser(userData.user);
      } catch (error) {
        logger(error.message);

        if (mounted) {
          clearToken();
          setUser(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    restoreSession();

    return () => {
      mounted = false;
    };
  }, []);

  // ─── Login (email/password) ───────────────────────────
  const login = useCallback(async (credentials) => {
    try {
      const { data } = await api.post("/users/login-user", credentials);
      setToken(data.accessToken);
      setUser(data.user);
    } catch (error) {
      logger(error);
      throw error;
    }
  }, []);

  // ─── Login with Token (Google OAuth) ─────────────────
  const loginWithToken = useCallback(async (accessToken) => {
    try {
      setToken(accessToken);

      const { data } = await api.get("/users/me");
      setUser(data.user);
    } catch (error) {
      logger(error);
      clearToken();
      throw error;
    }
  }, []);

  // ─── Logout ───────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await api.post("/users/logout");
    } catch (error) {
      logger("Logout error:", error);
    } finally {
      clearToken();
      setUser(null);
    }
  }, []);

  // ─── Refresh User Profile ─────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get("/users/me");
      setUser(data.user);
    } catch (error) {
      logger(error);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      loading,
      login,
      loginWithToken,
      logout,
      refreshUser,
    }),
    [user, loading, login, loginWithToken, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
