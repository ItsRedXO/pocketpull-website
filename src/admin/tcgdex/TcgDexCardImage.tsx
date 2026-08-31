import React, { useState, useEffect } from 'react';
import { CardImageProps } from './types';

function getBasePath(url: string): string {
  if (!url) return '';
  if (url.endsWith('/high.png')) return url.slice(0, -9);
  if (url.endsWith('.png')) return url.slice(0, -4);
  return url;
}

const PLACEHOLDER_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='140' viewBox='0 0 100 140'%3E%3Crect width='100' height='140' rx='8' fill='%23111827'/%3E%3Crect x='8' y='8' width='84' height='124' rx='6' fill='none' stroke='%23374151' stroke-width='1.5'/%3E%3Ccircle cx='50' cy='58' r='18' fill='%23374151'/%3E%3Cpath d='M42 58a8 8 0 1 1 16 0 8 8 0 0 1-16 0z' fill='%236B7280'/%3E%3Crect x='20' y='88' width='60' height='6' rx='3' fill='%23374151'/%3E%3Crect x='28' y='100' width='44' height='4' rx='2' fill='%231F2937'/%3E%3C/svg%3E";

export const TcgDexCardImage: React.FC<CardImageProps> = ({ url, alt, className = '' }) => {
  const [step, setStep] = useState(0);
  const base = getBasePath(url);
  const src = step === 0 && base ? `${base}/high.png` : step === 1 && base ? `${base}.png` : PLACEHOLDER_SVG;
  
  const handleError = () => setStep(s => Math.min(s + 1, 2));
  
  useEffect(() => { 
    setStep(0); 
  }, [url]);

  return (
    <img 
      src={src} 
      alt={alt} 
      className={className} 
      onError={handleError} 
      loading="lazy" 
    />
  );
};
