import { createContext, useState, useEffect } from 'react';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('bey_user')) || null);

  useEffect(() => {
    const initGoogleAuth = async () => {
      const isWeb = !Capacitor.isNativePlatform();
      
      try {
        if (isWeb) {
          await GoogleAuth.initialize({
            clientId: '323729858315-uppbl49gqf4crr4qu51tt295djr3h0s9.apps.googleusercontent.com',
            scopes: ['profile', 'email'],
            grantOfflineAccess: false,
          });
        } else {
          await GoogleAuth.initialize({});
        }
      } catch (e) {
        console.warn('GoogleAuth init gagal:', e);
      }
    };

    initGoogleAuth();
  }, []);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('bey_user', JSON.stringify(userData));
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