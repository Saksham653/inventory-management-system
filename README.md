# SAM Inventory Management System

Production-ready inventory management web application built with FastAPI + React + PostgreSQL. Deployable on Render.com.

## Features

- **Full Inventory Management** — Products, Categories, Suppliers, Employees, Sales
- **Role-Based Access Control** — Admin / Manager / Staff with permission gates
- **AI Chatbot** — Claude-powered assistant with live inventory context
- **Secure Auth** — JWT tokens, bcrypt passwords, session management
- **Production-ready** — Docker, CI/CD, environment config, error logging

## Demo Login

| Email | Password | Role |
|-------|----------|------|
| admin@sam.com | admin123 | Admin (full access) |
| manager@sam.com | pass123 | Manager |
| staff@sam.com | pass123 | Staff (limited) |

## Quick Start (Local)

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- Python 3.12+

### 1. Clone & configure

```bash
git clone https://github.com/your-org/sam-ims.git
cd sam-ims
cp .env.example backend/.env
# Edit backend/.env and add your ANTHROPIC_API_KEY
```

### 2. Run with Docker Compose

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### 3. Run manually (without Docker)

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Deploy to Render.com

1. Push code to GitHub
2. Go to render.com → New → Blueprint
3. Connect your repository (Render reads `render.yaml`)
4. All services auto-create: API, Frontend, PostgreSQL, Redis
5. Set `ANTHROPIC_API_KEY` manually in Render dashboard
6. Deploy!

**Estimated cost: ~$24/month**
- Backend (Web Service): $7/mo
- Frontend (Static Site): Free
- PostgreSQL: $7/mo
- Redis: $10/mo

## Project Structure

```
sam-ims/
├── backend/
│   ├── app/
│   │   ├── api/          # Route handlers
│   │   ├── core/         # Config, security, DB, deps
│   │   ├── models/       # SQLAlchemy ORM models
│   │   └── services/     # Business logic
│   ├── tests/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Complete SPA (single file)
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .github/
│   └── workflows/
│       └── ci.yml
├── render.yaml
├── docker-compose.yml
└── .env.example
```

## API Reference

All endpoints require `Authorization: Bearer <token>` except `/api/v1/auth/login` and `/health`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/v1/auth/login | None | Login → JWT |
| POST | /api/v1/auth/register | None | Register user |
| GET | /api/v1/dashboard/stats | Any | Summary stats |
| GET | /api/v1/products/ | Any | List products |
| POST | /api/v1/products/ | Admin/Manager | Create product |
| PATCH | /api/v1/products/{id} | Admin/Manager | Update product |
| DELETE | /api/v1/products/{id} | Admin | Delete product |
| GET | /api/v1/employees/ | Any | List employees |
| POST | /api/v1/employees/ | Admin | Create employee |
| GET | /api/v1/suppliers/ | Any | List suppliers |
| POST | /api/v1/suppliers/ | Admin/Manager | Create supplier |
| GET | /api/v1/categories/ | Any | List categories |
| GET | /api/v1/sales/ | Any | List sales |
| POST | /api/v1/sales/ | Any | Record sale (auto-deducts stock) |
| POST | /api/v1/chatbot/chat | Any | AI chatbot |
| GET | /health | None | Health check |

## Security

- Passwords hashed with bcrypt (cost=12)
- All DB queries via SQLAlchemy ORM (no SQL injection possible)
- JWT tokens: 30-min access, 7-day refresh
- CORS restricted to frontend domain
- Input validation via Pydantic on all endpoints
- HTTPS enforced on Render (automatic TLS)

## Environment Variables

See `.env.example` for all configuration options.

Required in production:
- `DATABASE_URL` — PostgreSQL connection string
- `SECRET_KEY` — 256-bit random secret for JWT
- `ANTHROPIC_API_KEY` — From console.anthropic.com
- `FRONTEND_URL` — Your frontend URL (for CORS)
