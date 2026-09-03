const configuredBackend = String(import.meta.env.VITE_BACKEND_URL || '').trim();

// PostgreSQL migration: Railway is now the production backend. Keep VITE_BACKEND_URL
// as an override for preview/dev environments, but default production traffic here.
export const BACKEND_BASE = (configuredBackend || 'https://pocketpull-website-production.up.railway.app').replace(/\/$/, '');
