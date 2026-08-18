import { useGoogleLogin } from '@react-oauth/google';
import { Capacitor } from '@capacitor/core';

export default function GoogleSignInButton({ onLogin, compact = false, className = '' }) {
  const googleLogin = useGoogleLogin({
    prompt: 'select_account',
    onSuccess: async (response) => {
      try {
        const accessToken = response?.access_token;
        if (!accessToken) {
          console.error('Access token tidak ditemukan dari Google');
          return;
        }

        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!res.ok) {
          console.error('Gagal fetch userinfo dari Google:', res.status);
          return;
        }

        const data = await res.json();
        onLogin({
          sub: data.sub,
          email: data.email,
          name: data.name,
          picture: data.picture,
        });
      } catch (err) {
        console.error('Gagal login Google:', err);
      }
    },
  });

  const handleClick = async () => {
    if (Capacitor.isNativePlatform()) {
      const { loginNative } = await import('../auth/googleNative');
      const userData = await loginNative();
      onLogin(userData);
    } else {
      googleLogin();
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label="Login dengan Google"
        title="Login dengan Google"
        className={`inline-flex items-center justify-center gap-2 h-9 px-3 bg-white border border-gray-200 rounded-xl font-black text-[9px] uppercase tracking-widest text-gray-700 shadow-sm hover:bg-gray-100 active:scale-95 transition-all whitespace-nowrap ${className}`}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" className="flex-shrink-0">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        <span>Login</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-2 h-10 px-4 bg-white border border-gray-200 rounded-xl font-black text-[10px] uppercase tracking-widest text-gray-700 shadow-sm hover:bg-gray-100 active:scale-95 transition-all whitespace-nowrap ${className}`}
    >
      <svg viewBox="0 0 24 24" width="17" height="17" className="flex-shrink-0">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
      <span>Login Google</span>
    </button>
  );
}
