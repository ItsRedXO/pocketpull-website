import React, { useEffect, useState } from 'react';

interface RetryImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> {
  src?: string | null;
  fallback: React.ReactNode;
  maxRetries?: number;
  retryDelayMs?: number;
}

// tcgdex occasionally hasn't backfilled the .png export for a card while the
// .webp one works fine -- swap extension as a last resort before giving up.
function webpFallback(src: string): string | null {
  if (!/^https:\/\/assets\.tcgdex\.net\//.test(src)) return null;
  if (!/\.png$/i.test(src)) return null;
  return src.replace(/\.png$/i, '.webp');
}

/**
 * Card art hosts (tcgdex, legacy storage) occasionally 503 under a burst of
 * simultaneous requests -- e.g. a 28-card pull list mounting all at once.
 * Retries with backoff before giving up, so a transient hiccup doesn't leave
 * the tile permanently blank. Once retries are exhausted, also tries the
 * .webp variant of a tcgdex .png URL -- their CDN is missing the .png export
 * for some cards while .webp works.
 */
export const RetryImage: React.FC<RetryImageProps> = ({
  src, fallback, maxRetries = 2, retryDelayMs = 1000, ...imgProps
}) => {
  const [attempt, setAttempt] = useState(0);
  const [triedWebp, setTriedWebp] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setAttempt(0); setTriedWebp(false); setFailed(false); }, [src]);

  if (!src || failed) return <>{fallback}</>;

  const effectiveSrc = triedWebp ? webpFallback(src) ?? src : src;

  return (
    <img
      key={`${attempt}-${triedWebp}`}
      src={effectiveSrc}
      onError={() => {
        if (attempt < maxRetries) {
          setTimeout(() => setAttempt(a => a + 1), retryDelayMs * (attempt + 1));
          return;
        }
        if (!triedWebp && webpFallback(src)) { setTriedWebp(true); return; }
        setFailed(true);
      }}
      {...imgProps}
    />
  );
};
