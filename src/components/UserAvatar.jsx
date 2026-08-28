import { useEffect, useState } from 'react';

export default function UserAvatar({
  src,
  fallbackSrc = '',
  name,
  className = '',
  alt = 'avatar',
}) {
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc || '');
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setCurrentSrc(src || fallbackSrc || '');
    setImgError(false);
  }, [src, fallbackSrc]);

  const initial = (name || '?').charAt(0).toUpperCase();

  const handleError = () => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setImgError(false);
      return;
    }
    setImgError(true);
  };

  if (!currentSrc || imgError) {
    return (
      <div className={`flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-500 font-black ${className}`}>
        {initial}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      referrerPolicy="no-referrer"
      className={`${className} object-cover`}
      alt={alt}
      onError={handleError}
    />
  );
}
