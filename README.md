<div align="center">

<img src="assets/logo.png" alt="StockWaves Logo" width="110" />

# StockWaves

**AI-powered Inventory Management System**

*Real-time stock control · Smart analytics · Built for teams*

[![Live Demo](https://img.shields.io/badge/🌐_Live_App-Visit_Now-0066CC?style=for-the-badge)](https://inventory-management-system-ywux.onrender.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-asyncpg-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-multi--stage-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)

</div>

---

## 🌊 What is StockWaves?

**StockWaves** is a production-ready, full-stack inventory management platform that gives your team real-time control over products, sales, suppliers, and employees — all in one place. It ships with a built-in **AI assistant** powered by Groq that answers questions about your actual inventory data in plain English.

> 🚀 **Live at:** [https://inventory-management-system-ywux.onrender.com](https://inventory-management-system-ywux.onrender.com)

---

## 🔑 Demo Access

Try it instantly — no sign-up required:

| Role | Email | Password | Permissions |
|------|-------|----------|-------------|
| 🔴 **Admin** | `admin@sam.com` | `admin123` | Full access to all modules |
| 🟡 **Manager** | `manager@sam.com` | `pass123` | Products, Sales, Suppliers |
| 🟢 **Staff** | `staff@sam.com` | `pass123` | View & record sales only |

---

## ✨ Features

### 📊 Dashboard & Analytics
- Live KPI cards — Total Revenue, Products in stock, Active Employees, Low-stock alerts
- Interactive 6-month revenue trend (AreaChart)
- Category distribution with animated PieChart
- Recent sales feed with real-time updates

### 📦 Product Management
- Full CRUD — create, search, edit, delete products
- SKU tracking, brand tagging, category & supplier linkage
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
- JWT authentication (30-min access · 7-day refresh tokens)
- Passwords hashed with **bcrypt** (cost factor 12)
- Pydantic validation on all inputs — zero SQL injection risk
- CORS restricted to frontend domain
- HTTPS enforced automatically via Render (TLS)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Python 3.12 · FastAPI 0.115 · SQLAlchemy 2.0 (async) |
| **Frontend** | React 18.3 · Vite 5.4 · Recharts · Lucide React |
| **Database** | PostgreSQL with asyncpg driver |
| **Auth** | JWT via python-jose · bcrypt via passlib |
| **AI** | Groq API (LLM chatbot) |
| **Infra** | Docker multi-stage build · Render.com |
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
│   │   ├── dashboard.py      # Analytics & KPIs
│   │   ├── chatbot.py        # AI assistant (Groq)
│   │   └── uploader.py       # Excel/CSV bulk import
│   ├── core/
│   │   ├── config.py         # Environment settings (Pydantic)
│   │   ├── database.py       # Async SQLAlchemy engine
│   │   └── seed.py           # Initial data seeder
│   └── models/
│       └── schema.py         # ORM models
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Full React SPA
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── assets/
│   └── logo.png              # StockWaves logo
├── main.py                   # FastAPI entry + static file serving
├── requirements.txt
├── Dockerfile                # Multi-stage: Node build → Python serve
├── render.yaml               # Render deployment config
├── build.sh                  # Render build script
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

**Backend:**
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

## 🌐 Deploy to Render

1. Fork this repo to your GitHub account
2. Go to [render.com](https://render.com) → **New → Web Service**
3. Connect your repo → select **Docker** as the environment
4. Add these environment variables in the Render dashboard:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | Random 256-bit string for JWT signing |
| `GROQ_API_KEY` | From [console.groq.com](https://console.groq.com) |
| `FRONTEND_URL` | Your Render service URL (for CORS) |

5. Hit **Deploy** — Render handles the rest!

---

## 📡 API Reference

All endpoints require `Authorization: Bearer <token>` except login and register.

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/login` | Public | Login → returns JWT |
| `POST` | `/api/v1/auth/register` | Public | Register new user |
| `GET` | `/api/v1/dashboard/stats` | Any | KPIs & analytics |
| `GET` | `/api/v1/products/` | Any | List all products |
| `POST` | `/api/v1/products/` | Admin/Manager | Create product |
| `PATCH` | `/api/v1/products/{id}` | Admin/Manager | Update product |
| `DELETE` | `/api/v1/products/{id}` | Admin | Delete product |
| `GET` | `/api/v1/sales/` | Any | Sales history |
| `POST` | `/api/v1/sales/` | Any | Record sale (auto-deducts stock) |
| `GET` | `/api/v1/employees/` | Any | List employees |
| `POST` | `/api/v1/employees/` | Admin | Add employee |
| `GET` | `/api/v1/suppliers/` | Any | List suppliers |
| `POST` | `/api/v1/suppliers/` | Admin/Manager | Create supplier |
| `POST` | `/api/v1/chatbot/chat` | Any | AI assistant query |
| `POST` | `/api/v1/uploader/` | Admin/Manager | Bulk import via Excel |

Full interactive docs available at `/docs` when running locally.

---

## 🔑 Environment Variables

Copy `.env.example` → `.env` and fill in:

```env
DATABASE_URL=postgresql+asyncpg://user:password@host/dbname
SECRET_KEY=your-super-secret-256-bit-key
GROQ_API_KEY=your-groq-api-key
FRONTEND_URL=https://your-app.onrender.com
```

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
- [Render](https://render.com) — Seamless Docker-based cloud deployment
- [Recharts](https://recharts.org) — Composable charting library for React

---

<div align="center">

<img src="assets/logo.png" width="52" /><br><br>

**StockWaves** — Built with ❤️ by [Saksham653](https://github.com/Saksham653)

*Found this useful? Please ⭐ star the repo!*

</div>
