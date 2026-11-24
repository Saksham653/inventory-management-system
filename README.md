<div align="center">

<img src="https://github.com/user-attachments/assets/0f00c94b-3c85-4856-9d31-32a4c1c51ec2" alt="StockWaves Logo" width="110" />

# StockWaves

**AI-powered Inventory Management System**

*Real-time stock control · Smart analytics · Built for teams*

[![Landing Page](https://img.shields.io/badge/🌊_Landing_Page-Visit_Now-0f172a?style=for-the-badge)](https://saksham653.github.io/inventory-management-system/)
[![Live Demo](https://img.shields.io/badge/🚀_Live_App-Open_Now-0066CC?style=for-the-badge)](https://stockwaves.netlify.app)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-asyncpg-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-multi--stage-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)

</div>

---

## 🌊 What is StockWaves?

**StockWaves** is a production-ready, full-stack inventory management platform that gives your team real-time control over products, sales, suppliers, and employees — all in one place. It ships with a built-in **AI assistant** powered by Groq that answers questions about your actual inventory data in plain English.

> 🌊 **Landing Page:** [https://saksham653.github.io/inventory-management-system/](https://saksham653.github.io/inventory-management-system/)
>
> 🚀 **Live App:** [https://stockwaves.netlify.app](https://stockwaves.netlify.app)

---

## 🔑 Demo Access

Try it instantly — no sign-up required. These accounts exist only when `SEED_DEMO=true` (the default); passwords are checked by the server and stored as bcrypt hashes.

| Role | Email | Password | Permissions |
|------|-------|----------|-------------|
| 🔴 **Admin** | `admin@sam.com` | `admin123` | Full access to all modules |
| 🟡 **Manager** | `manager@sam.com` | `pass123` | Products, Sales, Suppliers |
| 🟢 **Staff** | `staff@sam.com` | `pass123` | View stock & record sales |

---

## ✨ Features

### 💸 Paisa Radar (the Today screen)
Inventory counted in rupees. Every morning the home screen answers three questions with plain arithmetic on your sales and stock ledger:
- **Where is my money stuck?** Cash at cost, bucketed by days since each product last sold (0–30, 31–60, 61–90, 90+). No sale for 60+ days counts as stuck.
- **What will run out?** Days of stock left vs supplier lead time + a 3-day buffer, with the sales at risk before a new delivery could arrive.
- **What should I do today?** Ranked actions by rupees at stake: reorder, bundle with a fast seller, a discount that stays above cost, return extra stock to the supplier.
- **How is this calculated?** Every figure opens the formula with your real numbers, and links to the ledger rows behind it.

### 🧾 Purchase Orders
- One click turns Paisa Radar's reorder list into draft purchase orders, one per supplier
- Edit quantities, mark as sent, then **Stock arrived** adds every line to stock through the ledger and updates cost prices

### 📊 Dashboard & Analytics
- Live KPI cards — Total Revenue, Products in stock, Active Employees, Low-stock alerts
- Interactive 6-month revenue trend (AreaChart)
- Category distribution with animated PieChart
- Recent sales feed with real-time updates

### 📒 Stock Ledger
- Every stock change (opening stock, stock in, sale, correction, return, voided sale) is an append-only ledger entry
- A product's quantity always equals the sum of its ledger entries, with who made each change and when
- Per-product stock history one click away from the product list

### 📦 Product Management
- Full CRUD — create, search, edit, delete products
- SKU tracking, brand tagging, category & supplier linkage
- Cost price and selling price, so margin and money-in-stock are visible
- Stock quantity with configurable **low-stock threshold** alerts
- Auto stock-deduction on every recorded sale

### 🗂️ Categories & Suppliers
- Organize products into named categories with descriptions
- Track supplier contact info, address, and linked inventory
- Full create / edit / delete with search and filters

### 👥 Employee Management
- Employee profiles — name, role, DOB, salary, contact, address
- Date of joining, gender tracking, full edit support
- Role-based permission gates: Admin / Manager / Staff

### 💰 Sales Management
- Record transactions with automatic stock deduction
- Customer contact tracking per sale
- Sales history with filters, search, and revenue summaries
- Per-product sales breakdown and trend charts

### 🤖 AI Chatbot (Groq-powered)
- Ask questions about your inventory in plain English
- Live data context — queries your actual stock, sales & employees
- Examples: *"Which products are running low?"*, *"Who made the most sales this month?"*
- Floating chat widget available across all pages

### 📁 Bulk Data Import
- Upload products and sales via **Excel / CSV**
- Built-in validation with row-level error reporting

### 🔐 Security
- Server-side JWT authentication (30-min access · 7-day refresh tokens); every API route requires a valid token
- Role checks enforced by the API: staff can view and sell, managers manage stock and catalogue, admins delete and manage people
- Passwords hashed with **bcrypt** (cost factor 12)
- Pydantic validation on all inputs — zero SQL injection risk
- CORS restricted to frontend domain
- HTTPS everywhere: Netlify and Railway both serve over TLS

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Python 3.12 · FastAPI 0.115 · SQLAlchemy 2.0 (async) |
| **Frontend** | React 18.3 · Vite 5.4 · Recharts · Lucide React |
| **Database** | PostgreSQL with asyncpg driver |
| **Auth** | JWT via python-jose · bcrypt via passlib |
| **AI** | Groq API (LLM chatbot) |
| **Infra** | Frontend on Netlify · API + PostgreSQL on Railway (Docker) |
| **Data** | Pandas · OpenPyXL (Excel import/export) |

---

## 📁 Project Structure

```
stockwaves/
├── app/
│   ├── api/
│   │   ├── auth.py           # JWT login & register
│   │   ├── products.py       # Product CRUD
│   │   ├── categories.py     # Category CRUD
│   │   ├── suppliers.py      # Supplier CRUD
│   │   ├── employees.py      # Employee CRUD
│   │   ├── sales.py          # Sales + auto stock deduction
│   │   ├── stock.py          # Stock ledger & adjustments
│   │   ├── dashboard.py      # Analytics & KPIs
│   │   ├── chatbot.py        # AI assistant (Groq)
│   │   └── uploader.py       # Excel/CSV bulk import
│   ├── core/
│   │   ├── config.py         # Environment settings (Pydantic)
│   │   ├── database.py       # Async SQLAlchemy engine
│   │   ├── security.py       # bcrypt + JWT helpers
│   │   ├── deps.py           # Auth & role dependencies
│   │   ├── migrate.py        # Adds new columns to existing databases
│   │   └── seed.py           # Demo users & sample shop
│   ├── services/
│   │   ├── stock.py          # The only code that changes stock (writes the ledger)
│   │   ├── radar.py          # Paisa Radar calculations
│   │   └── insights.py       # Days of cover & reorder risk
│   └── models/
│       └── schema.py         # ORM models
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Auth gate + page routing
│   │   ├── styles.css        # Design tokens (light + dark)
│   │   ├── lib/              # API client, auth context, formatting
│   │   ├── components/       # Shell + shared UI
│   │   └── pages/            # Dashboard, Products, Sales, Ledger, …
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── assets/
│   └── logo.png              # StockWaves logo
├── main.py                   # FastAPI entry + static file serving
├── requirements.txt
├── Dockerfile                # Multi-stage: Node build → Python serve (used by Railway)
├── netlify.toml              # Netlify build + /api proxy to Railway
└── .env.example
```

---

## ⚡ Quick Start

### Option A — Docker (Recommended)

```bash
git clone https://github.com/Saksham653/inventory-management-system.git
cd inventory-management-system
cp .env.example .env
# Fill in DATABASE_URL, SECRET_KEY, GROQ_API_KEY
docker build -t stockwaves .
docker run -p 8000:8000 --env-file .env stockwaves
```

Visit: [http://localhost:8000](http://localhost:8000)

### Option B — Manual

**Backend** (uses a local SQLite file when `DATABASE_URL` is not set, so no Postgres is needed for development):
```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend (dev mode):**
```bash
cd frontend
npm install
npm run dev                     # Runs on http://localhost:5173
```

API docs (Swagger UI): [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🌐 Deployment

The live app runs on two hosts, and both redeploy automatically on every merge to `main`:

| Part | Host | Details |
|------|------|---------|
| Frontend | **Netlify** | Builds `frontend/` per `netlify.toml`; proxies `/api/*` to Railway, so the browser only talks to one domain (no CORS setup) |
| API | **Railway** | Builds the `Dockerfile`; always on, Singapore region |
| Database | **Railway PostgreSQL** | Same project and region as the API |

### Set up your own copy

**1. API + database on Railway**
1. Create a project, add a **PostgreSQL** database.
2. Add a service from this GitHub repo (it builds the `Dockerfile`) and generate a public domain for it.
3. Set these variables on the API service:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway reference to the database) |
| `SECRET_KEY` | Random 256-bit string for JWT signing (required; without it logins reset on every restart) |
| `SEED_DEMO` | `true` for the public demo data and logins, `false` for a real shop |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Optional first admin account, created when no users exist |
| `GROQ_API_KEY` | From [console.groq.com](https://console.groq.com), for the AI assistant |
| `FRONTEND_URL` | Your Netlify URL (for CORS) |

Health check: `GET /api/v1/health` returns `{"status": "ok"}` when the API can reach the database.

**2. Frontend on Netlify**
1. In `netlify.toml`, point the `/api/*` redirect at your Railway domain.
2. Import the repo in Netlify. The build settings come from `netlify.toml` (base `frontend`, command `npm run build`, publish `dist`).

---

## 📡 API Reference

All endpoints require `Authorization: Bearer <token>` except login and register.

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/login` | Public | Login → access + refresh tokens |
| `POST` | `/api/v1/auth/refresh` | Public | Exchange a refresh token for new tokens |
| `GET` | `/api/v1/auth/me` | Any | Current user |
| `POST` | `/api/v1/auth/users` | Admin | Create a login for a team member |
| `GET` | `/api/v1/dashboard/stats` | Any | KPIs & analytics |
| `GET` | `/api/v1/radar/` | Any | Paisa Radar: stuck cash, reorder list, ranked actions |
| `GET` | `/api/v1/purchase-orders/` | Any | Purchase orders |
| `POST` | `/api/v1/purchase-orders/draft-from-radar` | Admin/Manager | Draft POs from the reorder list |
| `POST` | `/api/v1/purchase-orders/{id}/receive` | Admin/Manager | Receive stock into the ledger |
| `GET` | `/api/v1/products/` | Any | List all products |
| `POST` | `/api/v1/products/` | Admin/Manager | Create product |
| `PATCH` | `/api/v1/products/{id}` | Admin/Manager | Update product |
| `DELETE` | `/api/v1/products/{id}` | Admin | Delete product |
| `GET` | `/api/v1/sales/` | Any | Sales history |
| `POST` | `/api/v1/sales/` | Any | Record sale (server sets price, deducts stock via ledger) |
| `DELETE` | `/api/v1/sales/{id}` | Admin | Void a sale and return its stock |
| `GET` | `/api/v1/stock/movements` | Any | Stock ledger (filter by `product_id`) |
| `POST` | `/api/v1/stock/adjust` | Admin/Manager | Stock in, return or correction |
| `GET` | `/api/v1/employees/` | Admin/Manager | List employees |
| `POST` | `/api/v1/employees/` | Admin | Add employee |
| `GET` | `/api/v1/suppliers/` | Any | List suppliers |
| `POST` | `/api/v1/suppliers/` | Admin/Manager | Create supplier |
| `POST` | `/api/v1/chatbot/chat` | Any | AI assistant query |
| `POST` | `/api/v1/uploader/upload` | Admin/Manager | Bulk import via CSV/Excel/JSON/XML |

Full interactive docs available at `/docs` when running locally.

---

## 🔑 Environment Variables

Copy `.env.example` → `.env` and fill in:

```env
DATABASE_URL=postgresql+asyncpg://user:password@host/dbname   # omit locally to use SQLite
SECRET_KEY=your-super-secret-256-bit-key
GROQ_API_KEY=your-groq-api-key
FRONTEND_URL=https://your-site.netlify.app
SEED_DEMO=true
```

Existing databases are upgraded automatically on startup: new columns are added and every product gets an opening ledger entry.

---

## 📜 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

## 👤 Author

**Saksham**  
GitHub: [@Saksham653](https://github.com/Saksham653)  
Repository: [github.com/Saksham653/inventory-management-system](https://github.com/Saksham653/inventory-management-system)

---

## 🙏 Acknowledgements

- [FastAPI](https://fastapi.tiangolo.com) — Modern async Python web framework
- [Groq](https://groq.com) — Ultra-fast LLM inference for the AI chatbot
- [Railway](https://railway.com) — Always-on hosting for the API and PostgreSQL
- [Netlify](https://www.netlify.com) — Frontend hosting and the `/api` proxy
- [Recharts](https://recharts.org) — Composable charting library for React

---

<div align="center">

<img src="https://github.com/user-attachments/assets/0f00c94b-3c85-4856-9d31-32a4c1c51ec2" width="52" /><br><br>

**StockWaves** — Built with ❤️ by [Saksham653](https://github.com/Saksham653)

*Found this useful? Please ⭐ star the repo!*

</div>
