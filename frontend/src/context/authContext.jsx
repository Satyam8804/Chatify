import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import api, { setToken, clearToken, getToken } from "../api/axios";
import { logger } from "../utils/logger";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        let token = getToken();

        // If memory token missing → try refresh once
        if (!token) {
          const { data } = await api.post("/users/refresh-token");
          token = data.accessToken;
          setToken(token);
        }
        const { data } = await api.get("/users/me");
        setUser(data.user);
      } catch (error) {
        logger(error);
        clearToken();
        setUser(null);
      } finally {
        setLoading(false);
        setAppReady(true);
      }
    };

    restoreSession();

  }, []);

  const login = useCallback(async (credentials) => {
    const { data } = await api.post("/users/login-user", credentials);
    setToken(data.accessToken);
    setUser(data.user);
  }, []);

  const loginWithToken = useCallback(async (accessToken) => {
    setToken(accessToken);
    const { data } = await api.get("/users/me");
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/users/logout");
    } catch (error) {
      logger(error);
    } finally {
      clearToken();
      setUser(null);
    }
  }, []);

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
      appReady
    }),
    [user, loading,appReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
