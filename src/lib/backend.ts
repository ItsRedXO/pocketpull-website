const configuredBackend = String(import.meta.env.VITE_BACKEND_URL || '').trim();

export const BACKEND_BASE = (configuredBackend || 'https://b2nnhe2n.backend.blink.new').replace(/\/$/, '');
