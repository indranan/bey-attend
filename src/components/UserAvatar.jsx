import { useState } from 'react';

export default function UserAvatar({ src, name, className = '', alt = 'avatar' }) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || '?').charAt(0).toUpperCase();

  if (!src || imgError) {
    return (
      <div className={`flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-500 font-black ${className}`}>
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      referrerPolicy="no-referrer"
      className={`${className} object-cover`}
      alt={alt}
      onError={() => setImgError(true)}
    />
  );
}
