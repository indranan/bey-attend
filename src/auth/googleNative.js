import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

export const loginNative = async () => {
  await GoogleAuth.initialize({});
  const result = await GoogleAuth.signIn();
  return {
    sub: result.id,
    email: result.email,
    name: result.name,
    picture: result.image,
  };
};

export const logoutNative = async () => {
  try {
    await GoogleAuth.initialize({});
    await GoogleAuth.signOut();
  } catch (err) {
    console.error('Native sign out failed:', err);
  }
};
