import React, { useEffect, useState } from 'react';

interface RetryImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> {
  src?: string | null;
  fallback: React.ReactNode;
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Card art hosts (tcgdex, legacy storage) occasionally 503 under a burst of
 * simultaneous requests -- e.g. a 28-card pull list mounting all at once.
 * Retries with backoff before giving up, so a transient hiccup doesn't leave
 * the tile permanently blank.
 */
export const RetryImage: React.FC<RetryImageProps> = ({
  src, fallback, maxRetries = 2, retryDelayMs = 1000, ...imgProps
}) => {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setAttempt(0); setFailed(false); }, [src]);

  if (!src || failed) return <>{fallback}</>;

  return (
    <img
      key={attempt}
      src={src}
      onError={() => {
        if (attempt >= maxRetries) { setFailed(true); return; }
        setTimeout(() => setAttempt(a => a + 1), retryDelayMs * (attempt + 1));
      }}
      {...imgProps}
    />
  );
};
