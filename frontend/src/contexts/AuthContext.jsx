import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { authApi } from "../services/api";

const AuthContext = createContext(null);

const TOKEN_KEY = "crm_token";
const USER_KEY  = "crm_user";

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  const applyUser = (userData) => setUser(userData);

  const logout = useCallback(() => {
    // Revoga o token no servidor (fire-and-forget — sessão local limpa imediatamente)
    authApi.logout().catch(() => {});
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    // Limpa tokens antigos gravados em localStorage (migração para sessionStorage)
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    const token    = sessionStorage.getItem(TOKEN_KEY);
    const cached   = sessionStorage.getItem(USER_KEY);

    if (!token) {
      setLoading(false);
      return;
    }

    if (cached) {
      try { setUser(JSON.parse(cached)); } catch { /* ignore */ }
    }

    api.get("/auth/me")
      .then(({ data }) => {
        sessionStorage.setItem(USER_KEY, JSON.stringify(data));
        setUser(data);
      })
      .catch(() => {
        logout();
      })
      .finally(() => setLoading(false));
  }, [logout]);

  const login = async (email, senha) => {
    const { data } = await api.post("/auth/login", { email, senha });
    sessionStorage.setItem(TOKEN_KEY, data.access_token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(data.usuario));
    applyUser(data.usuario);
    return data.usuario;
  };

  const updateUser = (userData) => {
    sessionStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    return user.permissoes?.includes(permission) ?? false;
  };

  const hasAnyPermission = (...perms) => perms.some((p) => hasPermission(p));

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, hasPermission, hasAnyPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
