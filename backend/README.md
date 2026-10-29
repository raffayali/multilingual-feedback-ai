# Backend (Express + TypeScript + MySQL)

REST API for the Roman Urdu feedback app. It talks to MySQL (XAMPP) and to the Python
model service (`service/app.py`, port 8000).

## One-time setup

1. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. Create the database: open http://localhost/phpmyadmin, click **Import**, choose
   `database/schema.sql` (in the project root), click **Import**.
3. In this folder:
   ```
   cd backend
   copy .env.example .env
   npm install
   ```
4. Open `.env` and set `JWT_SECRET` to a long random string (at least 16 characters).
   If your MySQL root user has a password, set `DB_PASSWORD` too (XAMPP default: empty).

## Run

Terminal 1 (model service, from the project root, `.venv` active):
```
uvicorn service.app:app --port 8000
```
Terminal 2:
```
cd backend
npm run dev
```
API: http://localhost:4000/api/health

## Tests

```
npm test            # unit + API tests (no database needed, uses an in-memory repo)
npm run typecheck   # TypeScript check
```

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/health | no | health check |
| POST | /api/auth/register | no | `{email, password, name?}` |
| POST | /api/auth/login | no | `{email, password}` |
| GET | /api/auth/me | yes | current user |
| POST | /api/batches | yes | `{name, texts[]}` predicts and saves a batch (max 1000 texts) |
| GET | /api/batches | yes | list batches with label counts |
| GET | /api/batches/:id | yes | one batch |
| GET | /api/batches/:id/messages | yes | `?label=&page=&pageSize=` |
| PATCH | /api/messages/:id | yes | `{correctedLabel}` human correction |
| GET | /api/stats | yes | totals, average confidence, low confidence, corrections |

Send the token as `Authorization: Bearer <token>`.
