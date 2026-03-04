<div align="center">

# 📦 SAM IMS — Inventory Management System

**A production-ready, AI-powered inventory management platform**  
built with FastAPI · React · PostgreSQL · Docker

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Visit_Now-0066CC?style=for-the-badge)](https://inventory-management-system-ywux.onrender.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-asyncpg-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## 🚀 Live Demo

**👉 [https://inventory-management-system-ywux.onrender.com](https://inventory-management-system-ywux.onrender.com)**

Try it instantly with the demo accounts below — no sign-up needed.

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| 🔴 Admin | `admin@sam.com` | `admin123` | Full access — all modules |
| 🟡 Manager | `manager@sam.com` | `pass123` | Products, Sales, Suppliers |
| 🟢 Staff | `staff@sam.com` | `pass123` | View & record sales only |

---

## ✨ Features

### 📊 Dashboard & Analytics
- Real-time KPI cards — Total Revenue, Products, Employees, Low Stock alerts
- Interactive revenue trend charts (AreaChart — last 6 months)
- Category distribution with animated PieChart
- Recent sales feed with live updates

### 📦 Product Management
- Full CRUD — create, edit, delete, search products
- SKU tracking, brand, category & supplier linkage
- Stock quantity with configurable low-stock threshold alerts
- Price tier management per product

### 🗂️ Category & Supplier Management
- Organize products into categories with descriptions
- Track supplier contact info, address, and linked products
- Full create/edit/delete with search and filters

### 👥 Employee Management
- Employee profiles — name, role, DOB, contact, salary, address
- Role-based access control: Admin / Manager / Staff
- Date of joining, gender tracking, and full edit support

### 💰 Sales Management
- Record sales with automatic stock deduction
- Customer contact tracking per sale
- Sales history with filters, search, and revenue summaries
- Per-product sales breakdown

### 🤖 AI Chatbot Assistant
- Integrated AI assistant powered by **Groq**
- Live inventory context — asks questions about your actual stock, sales, and employees
- Natural language queries like *"Which products are low on stock?"* or *"Show me this month's top sales"*
- Floating chat widget available across all pages

### 🔐 Security
- JWT authentication (30-min access tokens, 7-day refresh)
- Passwords hashed with **bcrypt** (cost factor 12)
- Role-based permission gates on every action
- CORS restricted to frontend domain
- All inputs validated via **Pydantic** — zero SQL injection risk
- HTTPS enforced automatically on Render (TLS)

### 📁 Data Import
- Bulk upload products and sales via **Excel / CSV**
- Built-in uploader with validation and error reporting

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.12, FastAPI 0.115, SQLAlchemy 2.0 (async) |
| **Frontend** | React 18.3, Vite 5.4, Recharts, Lucide React |
| **Database** | PostgreSQL (asyncpg driver) |
| **Auth** | JWT (python-jose), bcrypt (passlib) |
| **AI** | Groq API |
| **Deployment** | Docker (multi-stage build), Render.com |
| **Data** | Pandas, OpenPyXL (Excel import/export) |

---

## 📁 Project Structure

```
inventory-management-system/
├── app/
│   ├── api/
│   │   ├── auth.py          # JWT login & register
│   │   ├── products.py      # Product CRUD
│   │   ├── categories.py    # Category CRUD
│   │   ├── suppliers.py     # Supplier CRUD
│   │   ├── employees.py     # Employee CRUD
│   │   ├── sales.py         # Sales & stock deduction
│   │   ├── dashboard.py     # Analytics & KPIs
│   │   ├── chatbot.py       # AI assistant (Groq)
│   │   └── uploader.py      # Excel/CSV bulk import
│   ├── core/
│   │   ├── config.py        # Environment settings
│   │   ├── database.py      # Async SQLAlchemy engine
│   │   └── seed.py          # Initial data seeder
│   └── models/
│       └── schema.py        # ORM models
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Full React SPA
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── main.py                  # FastAPI app entry + static serving
├── requirements.txt
├── Dockerfile               # Multi-stage build
├── render.yaml              # Render deployment config
├── build.sh                 # Render build script
└── .env.example
```

---

## ⚡ Quick Start (Local)

### Prerequisites
- Docker & Docker Compose, **or** Node.js 20+ & Python 3.12+

### Option A — Docker (Recommended)

```bash
git clone https://github.com/Saksham653/inventory-management-system.git
cd inventory-management-system
cp .env.example .env
# Fill in DATABASE_URL, SECRET_KEY, GROQ_API_KEY in .env
docker build -t sam-ims .
docker run -p 8000:8000 --env-file .env sam-ims
```

Visit: [http://localhost:8000](http://localhost:8000)

### Option B — Manual

**Backend:**
```bash
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend (dev mode):**
```bash
cd frontend
npm install
npm run dev
```

- Frontend dev server: [http://localhost:5173](http://localhost:5173)
- Backend API + Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🌐 Deploy to Render

1. Fork this repository to your GitHub
2. Go to [render.com](https://render.com) → **New → Web Service**
3. Connect your GitHub repo → select **Docker** as environment
4. Set the following environment variables in Render dashboard:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | Random 256-bit string for JWT signing |
| `GROQ_API_KEY` | From [console.groq.com](https://console.groq.com) |
| `FRONTEND_URL` | Your Render service URL (for CORS) |

5. Click **Deploy** — Render handles the rest!

---

## 📡 API Reference

All endpoints require `Authorization: Bearer <token>` except login.

| Method | Endpoint | Role Required | Description |
|--------|----------|---------------|-------------|
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
| `POST` | `/api/v1/chatbot/chat` | Any | AI assistant query |
| `POST` | `/api/v1/uploader/` | Admin/Manager | Bulk import via Excel |

Interactive docs available at `/docs` (Swagger UI) when running locally.

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL=postgresql+asyncpg://user:password@host/dbname
SECRET_KEY=your-256-bit-random-secret
GROQ_API_KEY=your-groq-api-key
FRONTEND_URL=https://your-app.onrender.com
```

---

## 📜 License

This project is licensed under the **MIT License**.  
See [LICENSE](LICENSE) for full details.

---

## 👤 Author

**Saksham**  
GitHub: [@Saksham653](https://github.com/Saksham653)  
Repository: [inventory-management-system](https://github.com/Saksham653/inventory-management-system)

---

## 🙏 Acknowledgements

- [FastAPI](https://fastapi.tiangolo.com) — Modern Python web framework
- [Groq](https://groq.com) — Ultra-fast AI inference for the chatbot
- [Render](https://render.com) — Seamless cloud deployment
- [Recharts](https://recharts.org) — Composable chart library for React

---

<div align="center">

Made with ❤️ by [Saksham653](https://github.com/Saksham653)

⭐ If you found this useful, please consider starring the repo!

</div>
