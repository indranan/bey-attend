import { createContext, useState } from 'react';
import { login as authLogin } from '../auth/authService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('bey_user')) || null);

  const login = async () => {
    try {
      const userData = await authLogin();
      setUser(userData);
      localStorage.setItem('bey_user', JSON.stringify(userData));
      return userData;
    } catch (err) {
      console.error('Login failed:', err);
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('bey_user');
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