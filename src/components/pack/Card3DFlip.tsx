import React, { Component, Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';

class FlipErrorBoundary extends Component<{ children: React.ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false };
  componentDidCatch() { this.setState({ failed: true }); this.props.onError?.(); }
  render() {
    if (this.state.failed) return (
      <div style={{ width: 260, height: 365, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffd700', fontSize: 13 }}>
        Card reveal unavailable
      </div>
    );
    return this.props.children;
  }
}

export type WonCard = { name: string; rarity: string; value: number; imageUrl: string | null; emoji?: string };
export type RarityTier = 'common' | 'uncommon' | 'rare' | 'ultra' | 'cinematic';

// 1×1 transparent PNG used when there's no card image (keeps useLoader unconditional)
const BLANK =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=';

// ── Canvas texture helpers ────────────────────────────────────────────────────

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function makeBackTexture(): THREE.CanvasTexture {
  const W = 512, H = 716;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1c1d30'); bg.addColorStop(1, '#0c0d18');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(255,215,0,0.065)'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  ctx.strokeStyle = 'rgba(255,215,0,0.26)'; ctx.lineWidth = 2.5;
  rr(ctx, 10, 10, W - 20, H - 20, 18); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,215,0,0.11)'; ctx.lineWidth = 1;
  rr(ctx, 26, 26, W - 52, H - 52, 12); ctx.stroke();

  ctx.beginPath(); ctx.arc(W / 2, H / 2, 74, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,215,0,0.28)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(255,215,0,0.045)'; ctx.fill();

  ctx.fillStyle = 'rgba(255,215,0,0.9)';
  ctx.font = 'bold 82px Georgia, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,215,0,0.65)'; ctx.shadowBlur = 30;
  ctx.fillText('P', W / 2, H / 2);
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(255,215,0,0.48)';
  ctx.font = '600 16px Courier New, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('POCKETPULL', W / 2, H / 2 + 100);

  [[44, 44], [W - 44, 44], [44, H - 44], [W - 44, H - 44]].forEach(([x, y]) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = 'rgba(255,215,0,0.2)'; ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
  });

  return new THREE.CanvasTexture(c);
}

function makeFallbackFront(card: WonCard, color: string): THREE.CanvasTexture {
  const W = 512, H = 716;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#141520'); bg.addColorStop(1, '#08090f');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = color + 'cc'; ctx.lineWidth = 3;
  rr(ctx, 10, 10, W - 20, H - 20, 18); ctx.stroke();

  ctx.font = '130px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(card.emoji || '🃏', W / 2, H / 2 - 60);

  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 34px sans-serif';
  ctx.textBaseline = 'top'; ctx.fillText(card.name, W / 2, H / 2 + 80);
  ctx.fillStyle = color; ctx.font = '600 22px sans-serif';
  ctx.fillText(card.rarity.toUpperCase(), W / 2, H / 2 + 130);
  ctx.fillStyle = '#ffd700'; ctx.font = '600 26px Courier New, monospace';
  ctx.fillText('$' + card.value.toFixed(2), W / 2, H / 2 + 168);

  return new THREE.CanvasTexture(c);
}

// ── Loading placeholder (shown while Suspense resolves) ───────────────────────

function LoadingCard() {
  const tex = useMemo(() => makeBackTexture(), []);
  useEffect(() => () => { tex.dispose(); }, [tex]);
  return (
    <group>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[2.5, 3.5]} />
        <meshStandardMaterial map={tex} roughness={0.4} metalness={0.1} />
      </mesh>
    </group>
  );
}

// ── Main card mesh with GSAP flip ─────────────────────────────────────────────

interface CardMeshProps {
  card: WonCard;
  colorHex: string;
  tier: RarityTier;
  cardBackUrl?: string;
  onFlipComplete: () => void;
}

function CardMesh({ card, colorHex, tier, cardBackUrl, onFlipComplete }: CardMeshProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const orbRef = useRef<THREE.PointLight>(null!);
  const frontMatRef = useRef<THREE.MeshStandardMaterial>(null!);

  const canvasBackTex = useMemo(() => makeBackTexture(), []);
  const fallbackTex = useMemo(() => makeFallbackFront(card, colorHex), [card, colorHex]);
  const loadedTex = useLoader(THREE.TextureLoader, card.imageUrl || BLANK);
  const urlBackTex = useLoader(THREE.TextureLoader, cardBackUrl || BLANK);

  const frontTex = card.imageUrl ? loadedTex : fallbackTex;
  const backTex = cardBackUrl ? urlBackTex : canvasBackTex;

  const color3 = useMemo(() => new THREE.Color(colorHex), [colorHex]);

  useEffect(() => () => { canvasBackTex.dispose(); fallbackTex.dispose(); }, [canvasBackTex, fallbackTex]);

  // Orbiting fill light and holographic emissive cycle
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (orbRef.current) {
      orbRef.current.position.set(Math.sin(t * 0.9) * 3.2, Math.cos(t * 0.55) * 2, Math.cos(t * 0.9) * 2.5 + 2);
    }
    if (frontMatRef.current && tier === 'cinematic') {
      frontMatRef.current.emissive.setHSL((t * 0.12) % 1, 0.85, 0.14);
    }
  });

  // GSAP flip: anticipation tilt → main flip → micro settle
  useEffect(() => {
    const rotation = groupRef.current.rotation;
    const tl = gsap.timeline({ delay: 0.28 });
    tl.to(rotation, { y: -0.32, duration: 0.18, ease: 'power1.inOut' })
      .to(rotation, {
        y: Math.PI,
        duration: 0.68,
        ease: 'power2.inOut',
        onComplete: onFlipComplete,
      })
      .to(rotation, { y: Math.PI - 0.05, duration: 0.1, ease: 'power1.inOut' })
      .to(rotation, { y: Math.PI, duration: 0.08 });
    return () => { tl.kill(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const metalness = tier === 'cinematic' ? 0.72 : tier === 'ultra' ? 0.52 : tier === 'rare' ? 0.28 : 0.05;
  const roughness = tier === 'cinematic' ? 0.08 : tier === 'ultra' ? 0.18 : tier === 'rare' ? 0.32 : 0.62;

  return (
    <group ref={groupRef}>
      {/* Orbiting colored point light */}
      <pointLight ref={orbRef} color={color3} intensity={tier === 'common' ? 0.6 : 1.6} distance={8} decay={2} />

      {/* Back face — starts facing camera (group rotation 0) */}
      <mesh position={[0, 0, 0.022]}>
        <planeGeometry args={[2.5, 3.5]} />
        <meshStandardMaterial map={backTex} roughness={0.38} metalness={0.12} />
      </mesh>

      {/* Front face — local Y rotation π so combined with group π = 2π ≡ 0 (faces camera after flip) */}
      <mesh rotation={[0, Math.PI, 0]} position={[0, 0, -0.022]}>
        <planeGeometry args={[2.5, 3.5]} />
        <meshStandardMaterial
          ref={frontMatRef}
          map={frontTex}
          roughness={roughness}
          metalness={metalness}
          emissive={color3}
          emissiveIntensity={tier === 'common' ? 0 : 0.07}
        />
      </mesh>

      {/* Additive shimmer overlay for ultra/cinematic */}
      {(tier === 'ultra' || tier === 'cinematic') && (
        <mesh rotation={[0, Math.PI, 0]} position={[0, 0, -0.008]}>
          <planeGeometry args={[2.5, 3.5]} />
          <meshStandardMaterial
            color={colorHex}
            metalness={1}
            roughness={0}
            transparent
            opacity={0.11}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

// ── Exported component ────────────────────────────────────────────────────────

interface Card3DFlipProps {
  card: WonCard;
  colorHex: string;
  tier: RarityTier;
  cardBackUrl?: string;
  onDone: () => void;
}

export function Card3DFlip({ card, colorHex, tier, cardBackUrl, onDone }: Card3DFlipProps) {
  return (
    <FlipErrorBoundary onError={onDone}>
      <div style={{ width: 260, height: 365, margin: '0 auto' }}>
        <Canvas
          gl={{ alpha: true, antialias: true }}
          camera={{ position: [0, 0, 5], fov: 45 }}
        >
          <ambientLight intensity={0.28} />
          <directionalLight position={[3, 4, 5]} intensity={0.85} />
          <Suspense fallback={<LoadingCard />}>
            <CardMesh card={card} colorHex={colorHex} tier={tier} cardBackUrl={cardBackUrl} onFlipComplete={onDone} />
          </Suspense>
        </Canvas>
      </div>
    </FlipErrorBoundary>
  );
}
