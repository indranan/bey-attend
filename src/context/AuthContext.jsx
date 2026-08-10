import { createContext, useState } from 'react';
import { login as authLogin, hardLogout as authHardLogout } from '../auth/authService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('bey_user')) || null);

  const login = async (userData) => {
    try {
      let data = userData;
      if (!data) {
        data = await authLogin();
      }
      setUser(data);
      localStorage.setItem('bey_user', JSON.stringify(data));
      return data;
    } catch (err) {
      console.error('Login failed:', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await authHardLogout();
    } finally {
      setUser(null);
      localStorage.removeItem('bey_user');
    }
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('bey_user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};