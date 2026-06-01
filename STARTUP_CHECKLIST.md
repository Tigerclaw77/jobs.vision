# STARTUP CHECKLIST

## Values Paul Must Copy From Neon

Only these Neon values are required for the first startup and login test:

1. `DATABASE_URL`
2. `REACT_APP_NEON_AUTH_URL`
3. `NEON_AUTH_JWKS_URL`

## Step 1: Get Neon values

From the Neon dashboard, copy:

- `DATABASE_URL`: the Postgres connection string for the Neon database.
- `REACT_APP_NEON_AUTH_URL`: the Neon Auth frontend/base URL.
- `NEON_AUTH_JWKS_URL`: the Neon Auth JWKS URL for backend JWT verification.

## Step 2: Populate env files

Open `backend/.env` and replace:

```dotenv
DATABASE_URL='<PASTE_DATABASE_URL_FROM_NEON>'
NEON_AUTH_JWKS_URL='<PASTE_NEON_AUTH_JWKS_URL_FROM_NEON>'
```

Open `frontend/.env` and replace:

```dotenv
REACT_APP_NEON_AUTH_URL='<PASTE_REACT_APP_NEON_AUTH_URL_FROM_NEON>'
```

Keep these local defaults for the first run:

```dotenv
# backend/.env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
APP_URL=http://localhost:3000
PUBLIC_API_URL=http://localhost:5000
PGPOOL_MAX=10
STRIPE_SKIP_VERIFY=false

# frontend/.env
REACT_APP_API_URL=http://localhost:5000/api
```

## Step 3: Apply schema

Use Git Bash from the repository root:

```bash
cd /c/Users/pauld/Desktop/jobs.vision
set -a
source backend/.env
set +a
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f neon-schema.sql
```

Exact command to apply `neon-schema.sql`:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f neon-schema.sql
```

Exact command to apply `neon-migrations` in order:

```bash
for f in neon-migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

For first startup, use the single-file `neon-schema.sql` command above.

## Step 4: Start backend

Use a new Git Bash terminal:

```bash
cd /c/Users/pauld/Desktop/jobs.vision/backend
npm run start
```

Expected local API:

```text
http://localhost:5000/api/health
```

## Step 5: Start frontend

Use a second Git Bash terminal:

```bash
cd /c/Users/pauld/Desktop/jobs.vision/frontend
npm start
```

Expected local app:

```text
http://localhost:3000
```

## Step 6: Login using candidate@test.com

Open:

```text
http://localhost:3000/login
```

Login with:

```text
candidate@test.com
```

Use the password configured for that test user in Neon Auth.

## Remaining Required Env Vars For Startup

Required before the backend can boot:

- `DATABASE_URL`

Required before protected login flows work:

- `NEON_AUTH_JWKS_URL`
- `REACT_APP_NEON_AUTH_URL`

No other env vars are required for the first local startup test.

## Remaining Blockers Before First Run

- Replace the three Neon placeholders in `backend/.env` and `frontend/.env`.
- Apply `neon-schema.sql` to the fresh Neon database.
- `psql` must be available in Git Bash before Step 3. Current shell check did not find `psql` on PATH, so install PostgreSQL command-line tools or add `psql` to PATH if Git Bash also cannot find it.
- Confirm the Neon Auth test user `candidate@test.com` exists and has a known password.
