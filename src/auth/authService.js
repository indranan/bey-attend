import { Capacitor } from '@capacitor/core';
import { loginNative, logoutNative } from './googleNative';
import { loginWeb, logoutWeb } from './googleWeb';

export const login = async () => {
  if (Capacitor.isNativePlatform()) {
    return await loginNative();
  } else {
    return await loginWeb();
  }
};

export const hardLogout = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      await logoutNative();
    } else {
      await logoutWeb();
    }
  } catch (err) {
    console.error('Hard logout failed:', err);
  }
};
