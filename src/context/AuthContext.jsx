import { createContext, useState } from 'react';
import { login as authLogin, hardLogout as authHardLogout } from '../auth/authService';

export const AuthContext = createContext();

const CURRENT_PLAYER_KEY = 'bey_current_player';

const loadCurrentPlayer = () => {
  try {
    const cached = localStorage.getItem(CURRENT_PLAYER_KEY);
    if (cached) return JSON.parse(cached);
  } catch {
    // ignore parse error
  }
  return null;
};

const saveCurrentPlayer = (player) => {
  try {
    localStorage.setItem(CURRENT_PLAYER_KEY, JSON.stringify(player));
  } catch {
    // ignore storage error
  }
};

const clearCurrentPlayer = () => {
  try {
    localStorage.removeItem(CURRENT_PLAYER_KEY);
  } catch {
    // ignore storage error
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('bey_user')) || null);
  const [currentPlayer, setCurrentPlayer] = useState(loadCurrentPlayer);

  const login = async (userData) => {
    try {
      let data = userData;
      if (!data) {
        data = await authLogin();
      }
      setUser(data);
      localStorage.setItem('bey_user', JSON.stringify(data));
      setCurrentPlayer(null);
      clearCurrentPlayer();
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
      setCurrentPlayer(null);
      localStorage.removeItem('bey_user');
      clearCurrentPlayer();
    }
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('bey_user', JSON.stringify(userData));
  };

  const setPlayer = (player) => {
    setCurrentPlayer(player);
    saveCurrentPlayer(player);
  };

  const refreshPlayer = async (playerData) => {
    setCurrentPlayer(playerData);
    saveCurrentPlayer(playerData);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, currentPlayer, setPlayer, refreshPlayer }}>
      {children}
    </AuthContext.Provider>
  );
};
