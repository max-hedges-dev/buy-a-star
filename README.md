# Aster Atlas Auth, Payments, and Demo Mode Setup

This project now uses Google authentication for the normal customer journey, plus an internal demo mode for founders/builders/testers.

## What was added

- Google Identity Services on the frontend
- Backend Google ID token verification
- Persistent `users` and `auth_sessions` tables
- HTTP-only app session cookie handling
- Logout
- `GET /api/v1/auth/me` to restore session state
- `GET /api/v1/auth/protected` as a protected-route proof
- Frontend `/auth` and protected `/account` routes
- Internal demo users and demo checkout when explicitly enabled by environment variables

## Local environment

### Backend

1. Copy [backend/.env.example](/C:/Users/max_h/OneDrive/Documents/Vodafone%20Work/Dev%20Projects/Buy-A-Star%20-%20Copy/backend/.env.example) to `backend/.env`.
2. Fill in:
   - `APP_ENV`
   - `DEMO_MODE`
   - `ALLOW_DEMO_AUTH`
   - `ALLOW_DEMO_CHECKOUT`
   - `GOOGLE_CLIENT_ID`
   - `SESSION_SECRET`
   - `FRONTEND_ORIGIN`
   - `BACKEND_ORIGIN`
   - `DATABASE_URL`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET` (optional for local fallback flow, required when testing Stripe webhooks)
   - `STRIPE_CURRENCY`
   - `STRIPE_CERTIFICATE_PRICE_GBP`
3. Install backend dependencies:

```powershell
cd backend
.\venv\Scripts\pip install -r requirements.txt
```

4. Run the new migration:

```powershell
cd backend
.\venv\Scripts\alembic upgrade head
```

5. Start the backend:

```powershell
cd backend
.\venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend

1. Copy [frontend/.env.example](/C:/Users/max_h/OneDrive/Documents/Vodafone%20Work/Dev%20Projects/Buy-A-Star%20-%20Copy/frontend/.env.example) to `frontend/.env`.
2. Fill in:
   - `VITE_APP_ENV`
   - `VITE_DEMO_MODE`
   - `VITE_API_BASE_URL`
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_API_URL` (still supported for backward compatibility)
   - `VITE_STRIPE_PUBLISHABLE_KEY`
3. Start the frontend:

```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

Use the same host family on both apps during local development.
Recommended:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8000`

That avoids cookie issues caused by mixing `localhost` and `127.0.0.1`.

## Google Cloud Console setup

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Configure the OAuth consent screen if you have not already done so.
   For local testing with an external app, add your own Google account as a test user if Google requires it.
4. Go to `APIs & Services` -> `Credentials`.
5. Create `OAuth client ID`.
6. Choose `Web application`.
7. Add these Authorized JavaScript origins for local development:
   - `http://127.0.0.1:5173`
   - `http://localhost:5173`
8. Add your production frontend origin later as another Authorized JavaScript origin.
9. Redirect URIs are not required for this implementation because the frontend uses the Google Identity Services popup/button flow and receives the ID token directly in JavaScript.
10. Copy the generated client ID.
11. Place that same value in:
   - `backend/.env` as `GOOGLE_CLIENT_ID`
   - `frontend/.env` as `VITE_GOOGLE_CLIENT_ID`

## Session behavior

- The frontend never trusts Google auth state by itself.
- The frontend sends the Google ID token to the backend.
- The backend verifies the token against `GOOGLE_CLIENT_ID`.
- After verification, the backend creates its own session record and sets an HTTP-only cookie.
- Protected frontend routes depend on `GET /api/v1/auth/me` and `GET /api/v1/auth/protected`, not on client-only state.

## New auth endpoints

- `POST /api/v1/auth/google`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/protected`

## Stripe checkout

- The app now uses Stripe Embedded Checkout in sandbox mode.
- The frontend requires the user to accept the Privacy Notice and Terms & Conditions before creating a checkout session.
- The backend creates the Checkout Session and returns the Stripe `client_secret` for embedded mounting.
- Payment fulfillment is server-side.
  - Primary path: Stripe webhook events
  - Local development fallback: `GET /api/v1/checkout/session-status` verifies and fulfills a paid session when the success page loads

### Stripe endpoints

- `POST /api/v1/checkout/session`
- `POST /api/v1/checkout/demo-complete`
- `GET /api/v1/checkout/session-status`
- `POST /api/v1/checkout/webhook`

### Local Stripe testing

1. Keep Stripe in sandbox/test mode.
2. Add your test publishable key to `frontend/.env` as `VITE_STRIPE_PUBLISHABLE_KEY`.
3. Add your test secret key to `backend/.env` as `STRIPE_SECRET_KEY`.
4. Run the migration:

```powershell
cd backend
.\venv\Scripts\python -m alembic upgrade head
```

5. Restart both dev servers after changing env vars.
6. For webhook testing later, add a Stripe webhook endpoint secret to `STRIPE_WEBHOOK_SECRET`.
   During local development, you can still complete the flow through the post-checkout status verification page even if the webhook secret is blank.

## Notes for production

- Serve the frontend and backend over HTTPS.
- Set `BACKEND_ORIGIN` to the real HTTPS backend origin so the cookie is marked `Secure`.
- Keep `SESSION_SECRET` long and random.
- Add only real deployed frontend domains to the Google OAuth client’s Authorized JavaScript origins.

## Demo / staging mode

Demo mode is for internal testing only. It is not the customer-facing no-account journey.

### Backend example

```env
APP_ENV=staging
DEMO_MODE=true
ALLOW_DEMO_AUTH=true
ALLOW_DEMO_CHECKOUT=true
DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/aster-atlas-staging
```

### Frontend example

```env
VITE_APP_ENV=staging
VITE_DEMO_MODE=true
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

### Demo mode behavior

- Shows demo sign-in options on `/auth`
- Lets testers continue as seeded demo users:
  - demo buyer
  - demo recipient
  - demo collector
- Shows a demo toolbar in the app
- Enables `Complete Demo Registration` instead of requiring Stripe
- Marks created data as demo data in users, transactions, and registrations

### Safety rules

- Demo auth and demo checkout only appear when the environment flags are enabled
- Production should keep `DEMO_MODE=false`
- Staging/demo should use a separate database from production

### Demo testing flow

1. Enable the demo flags in both `backend/.env` and `frontend/.env`
2. Restart backend and frontend
3. Open `/auth`
4. Continue as a demo user
5. Open a star and use `Complete Demo Registration`
6. Verify:
   - account overview
   - checkout complete page
   - ownership page
   - public StarWiki page
7. For gift testing:
   - choose `For someone else`
   - complete a demo registration
   - open the generated claim page
