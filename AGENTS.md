# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

SEQ Angler is a fishing companion app for South East Queensland with two components:

- **Backend**: Python FastAPI server at `backend/server.py` (port 8001)
- **Frontend**: Expo React Native app at `frontend/` (port 8081 for web)

### Services

| Service | How to start | Port |
|---------|-------------|------|
| MongoDB | `mongod --dbpath /data/db --logpath /var/log/mongod.log --logappend --fork` | 27017 |
| Backend | `cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload` | 8001 |
| Frontend (web) | `cd frontend && npx expo start --web --port 8081` | 8081 |

### Non-obvious gotchas

- The `emergentintegrations` package (used for Stripe checkout) is **not on PyPI**. A local stub module at `backend/emergentintegrations/` provides the necessary imports. Stripe checkout endpoints will raise `NotImplementedError` but all other endpoints work fine without it.
- The backend hardcodes `/app/backend/uploads` as the upload directory (Docker path convention). You must `mkdir -p /app/backend/uploads` before starting the server.
- Backend `.env` file is required at `backend/.env` with at minimum `MONGO_URL` and `DB_NAME`. See `backend/server.py` lines 25-27 for all env vars.
- Python packages install to `~/.local/bin` — ensure `export PATH="$HOME/.local/bin:$PATH"` is in your shell.
- Frontend uses `yarn` (lockfile: `frontend/yarn.lock`).

### Lint / Test / Build

- **Backend lint**: `cd backend && flake8 server.py --max-line-length=200`
- **Frontend lint**: `cd frontend && npx expo lint`
- **Backend tests**: `cd backend && pytest` (if test files exist)
- **Frontend web**: `cd frontend && npx expo start --web`
