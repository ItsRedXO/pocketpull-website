import React from 'react';

/**
 * PokeAPI's official-artwork images are full-body and vary wildly in
 * proportions/framing (compare Onix's wide coil to Diglett's small centered
 * body), so a single fixed crop makes some Pokemon look cut off or oddly
 * zoomed. scale/offsetX/offsetY are per-species knobs (see the admin Species
 * editor) an admin can nudge until a given Pokemon frames well; defaults
 * reproduce the original fixed crop.
 */
export function PokemonPortrait({ artworkUrl, alt, scale = 1.5, offsetX = 0, offsetY = 0, className }: {
  artworkUrl: string | null; alt: string; scale?: number; offsetX?: number; offsetY?: number; className?: string;
}) {
  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden' }}>
      {artworkUrl && (
        <img src={artworkUrl} alt={alt} style={{
          position: 'absolute', top: '50%', left: '50%', width: '100%', height: '100%', objectFit: 'contain',
          transform: `translate(-50%, -50%) scale(${scale}) translate(${offsetX}%, ${offsetY}%)`,
        }} />
      )}
    </div>
  );
}
