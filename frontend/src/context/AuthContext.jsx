import { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../services/endpoints";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("ter_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("ter_token");
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(({ data }) => {
        setUser(data.user);
        localStorage.setItem("ter_user", JSON.stringify(data.user));
      })
      .catch(() => {
        localStorage.removeItem("ter_token");
        localStorage.removeItem("ter_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await authApi.login({ email, password });
    localStorage.setItem("ter_token", data.token);
    localStorage.setItem("ter_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const signup = async (name, email, password, extra = {}) => {
    const { data } = await authApi.signup({ name, email, password, ...extra });
    localStorage.setItem("ter_token", data.token);
    localStorage.setItem("ter_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("ter_token");
    localStorage.removeItem("ter_user");
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const { data } = await authApi.me();
      setUser(data.user);
      localStorage.setItem("ter_user", JSON.stringify(data.user));
      return data.user;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
