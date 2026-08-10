export const loginWeb = async () => {
  const clientId = '323729858315-uppbl49gqf4crr4qu51tt295djr3h0s9.apps.googleusercontent.com';

  const ensureGoogleScript = () => {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && window.google?.accounts?.id) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Gagal memuat Google Identity Services.'));
      document.head.appendChild(script);
    });
  };

  try {
    await ensureGoogleScript();
  } catch (err) {
    console.error('GIS load error:', err);
    return fallbackWebLogin();
  }

  return new Promise((resolve, reject) => {
    const decodeJwt = (token) => {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        return JSON.parse(jsonPayload);
      } catch (e) {
        console.error('JWT decode error:', e);
        return null;
      }
    };

    let isResolved = false;

    const handleCredential = (response) => {
      if (isResolved) return;
      isResolved = true;
      const payload = decodeJwt(response.credential);
      if (payload) {
        resolve({
          sub: payload.sub,
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
        });
      } else {
        reject(new Error('Gagal membaca kredensial Google.'));
      }
    };

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
      auto_select: false,
    });

    window.google.accounts.id.prompt((notification) => {
      if ((notification.isDismissedMoment() || notification.isNotDisplayed()) && !isResolved) {
        isResolved = true;
        reject(new Error('Login dibatalkan'));
      }
    });

    setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        reject(new Error('Login dibatalkan'));
      }
    }, 120000);
  });
};

const fallbackWebLogin = async () => {
  return new Promise((resolve, reject) => {
    const email = prompt('Login Google (Web Fallback). Masukkan email Google Anda:');
    if (!email) {
      reject(new Error('Login dibatalkan'));
      return;
    }
    resolve({
      sub: btoa(email),
      email,
      name: email.split('@')[0],
      picture: '',
    });
  });
};

export const logoutWeb = async () => {
  if (typeof window !== 'undefined' && window.google?.accounts?.id) {
    try {
      window.google.accounts.id.disableAutoSelect();
    } catch (err) {
      console.error('disableAutoSelect failed:', err);
    }
  }
};
