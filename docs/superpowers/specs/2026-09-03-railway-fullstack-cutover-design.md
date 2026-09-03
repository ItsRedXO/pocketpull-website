# PocketPull Railway Full-Stack Cutover Design

## Goal
Move PocketPull production frontend hosting off Blink so Railway serves the built Vite frontend and the PostgreSQL-backed Hono API from the same deployment, while preserving the existing application behavior and Blink authentication boundary.

## Target Architecture
- Railway builds the Vite frontend and packages its `dist` output into the production image.
- The existing Hono server continues serving `/health` and all API routes and also serves the compiled frontend assets and SPA fallback.
- The browser continues using the configured Railway backend URL for API traffic; Blink remains only where authentication/JWT verification is still required during this phase.
- Supabase PostgreSQL remains the application data source.
- The existing Blink project is not required for production hosting after DNS/domain cutover.

## Requirements
- Preserve the current React/Vite frontend without redesigning it.
- Preserve all existing Hono API routes and health-check behavior.
- Serve `/`, static assets, and client-side routes such as `/admin` from Railway.
- Keep API routes from being shadowed by the frontend fallback.
- Build frontend assets during the Docker image build; do not commit `dist`.
- Use the existing `VITE_BACKEND_URL` override when supplied, with Railway as the production fallback.
- Do not commit secrets or database credentials.
- Keep the current database migration pre-deploy command.
- Keep the Railway health check on `/health`.
- Do not require Blink hosting credits for production.

## Verification
- A fresh frontend build succeeds.
- The production Docker image builds successfully.
- The running Hono app returns PostgreSQL health JSON at `/health`.
- The running Hono app returns the compiled `index.html` at `/` and for an SPA route.
- API routes continue to resolve before the SPA fallback.
- The built frontend contains the Railway backend target and no legacy Blink backend URL.
- Existing database validation/integrity checks remain green.
