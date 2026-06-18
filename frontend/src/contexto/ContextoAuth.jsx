// Contexto de autenticacion con login, logout y sesion
import React, { createContext, useContext, useState, useEffect } from 'react';
import { peticionGet, peticionPost } from '../servicios/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verificarToken = async () => {
      const savedToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');

      if (savedToken && savedUser) {
        try {
          await peticionGet('/api/auth/me');
          setUser(JSON.parse(savedUser));
        } catch (err) {
          if (err.message && err.message.includes('401')) {
            console.warn("Sesión expirada o inválida.");
            localStorage.clear();
            sessionStorage.clear();
            setUser(null);
          } else {
            setUser(JSON.parse(savedUser));
          }
        }
      }
      setLoading(false);
    };

    verificarToken();
  }, []);

  const login = async (email, password, remember) => {
    try {
      const data = await peticionPost('/api/auth/login', { email, password, remember });
      const storage = remember ? localStorage : sessionStorage;

      storage.setItem('token', data.access_token);
      storage.setItem('refresh_token', data.refresh_token);
      storage.setItem('user', JSON.stringify({
        name: data.user_name,
        role: data.user_role,
        email,
      }));

      setUser({ name: data.user_name, role: data.user_role, email });
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (token) {
        await peticionPost('/api/auth/logout');
      }
    } catch (e) {
      
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
