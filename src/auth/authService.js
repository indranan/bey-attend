import { Capacitor } from '@capacitor/core';
import { loginNative } from './googleNative';
import { loginWeb } from './googleWeb';

export const login = async () => {
  if (Capacitor.isNativePlatform()) {
    return await loginNative();
  } else {
    return await loginWeb();
  }
};
