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
