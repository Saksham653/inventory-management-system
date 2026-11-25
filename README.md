<div align="center">

<img src="https://github.com/user-attachments/assets/0f00c94b-3c85-4856-9d31-32a4c1c51ec2" alt="StockWaves Logo" width="110" />

# StockWaves

**Inventory for Indian shops, counted in rupees**

*Paisa Radar · WhatsApp brief · Snap-a-Bill · Commands in English or Hinglish*

[![Landing Page](https://img.shields.io/badge/🌊_Landing_Page-Visit_Now-0f172a?style=for-the-badge)](https://stockwaves.netlify.app/#home)
[![Live Demo](https://img.shields.io/badge/🚀_Live_App-Open_Now-0066CC?style=for-the-badge)](https://stockwaves.netlify.app)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-asyncpg-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-multi--stage-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)

</div>

---

## 🌊 What is StockWaves?

**StockWaves** is inventory software for Indian shops that counts stock in rupees, not just pieces. It shows which stock isn't selling, what will run out before the next delivery, and drafts the order. Every morning it sends that as one WhatsApp you can approve with a tap. Supplier bills go into stock from a photo, and the whole app takes plain commands in English or Hinglish.

> 🌊 **Landing page and live demo:** [https://stockwaves.netlify.app](https://stockwaves.netlify.app) (signed-out visitors see the landing page; "Open the demo shop" signs you into the sample shop)

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

### ⌨️ Command bar (Ctrl K)
- Type what you want done: "reorder iPhones", "order 10 Galaxy S24 from Samsung", "add 20 USB-C Hub at 2200", "sold 2 Galaxy S24", "set price of iPad Air 5 to 61900", "set stock of Vivo V12 to 18" — plus Hinglish like "12 iPhone aaye" or "10 USB-C hub mangao"
- Every action shows a preview of exactly what will change; nothing happens until you confirm
- Done actions show an **Undo** (purchase orders are cancelled, stock and prices restored through the ledger)
- Questions like "what's running low?" or "what didn't sell this month?" are answered from Paisa Radar
- Everyday commands work without any AI key; with `GROQ_API_KEY` or `ANTHROPIC_API_KEY` it also understands free-form wording and questions
- The Assistant page keeps an action log: every command, what it changed, and who ran it

### 💬 WhatsApp brief
- Every morning (default 9:00 am IST) each person who opts in gets Paisa Radar on WhatsApp: stock value, what runs out before the next delivery, what's stuck, a ready reorder list and yesterday's sales. English or Hinglish
- **Approve order** drafts the purchase orders in one tap. If the numbers changed since the brief, it shows the new order with Confirm instead of running it
- Reply with any command ("sold 2 Galaxy S24", "20 USB-C Hub aaye", "what's running low?"): the same preview, Confirm, Undo and action log as the command bar. Also `yes` / `no`, `undo`, `brief`, `help`, `stop` / `start`
- **Preview mode** without a Meta account: the WhatsApp brief page has a phone that behaves exactly like WhatsApp, so the whole flow can be tried before connecting a number
- Incoming webhooks are checked against the Meta app secret; numbers that aren't linked to a user get one polite reply a day and nothing else

### 📸 Snap-a-Bill (Stock in)
- Photograph or upload a supplier bill, printed or handwritten; a vision model reads every item line, quantity and rate
- Each line is matched to your products (handles abbreviations, typos and SKUs), or pre-filled as a new product
- Review screen beside the photo: fix a match, quantity or cost, skip a line; totals are checked against the bill
- Confirm and every line goes into stock through the ledger, with the latest cost price; the photo is kept with the bill
- Learns each supplier's naming: once you confirm "Apple 20W adptr" is your adapter, their next bill matches it automatically
- Works with Claude (`ANTHROPIC_API_KEY`) or Groq (`GROQ_API_KEY`)

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
│   │   ├── whatsapp.py       # WhatsApp settings, phone preview, Meta webhook
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
│   │   ├── bill_reader.py    # Reads bill photos with Claude or Groq
│   │   ├── matching.py       # Matches bill lines to products, learns aliases
│   │   ├── commands.py       # Command bar: rules + AI, preview, execute, undo
│   │   ├── llm.py            # Claude / Groq helper for the command bar
│   │   ├── whatsapp.py       # Morning brief, replies, sending, daily schedule
│   │   ├── sales.py          # Recording and voiding sales
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
| `GROQ_API_KEY` | From [console.groq.com](https://console.groq.com), for the AI assistant (and bill scanning if no Anthropic key is set) |
| `ANTHROPIC_API_KEY` | Optional. From [platform.claude.com](https://platform.claude.com); used for bill scanning when set |
| `BILL_AI_PROVIDER` | Optional: `anthropic` or `groq` to force one; empty picks whichever key is set (Anthropic first) |
| `BILL_AI_MODEL` | Optional model override (defaults: `claude-opus-5-5`, `qwen/qwen3.8-27b`) |
| `FRONTEND_URL` | Your Netlify URL (for CORS) |

Health check: `GET /api/v1/health` returns `{"status": "ok"}` when the API can reach the database.

**2. Frontend on Netlify**
1. In `netlify.toml`, point the `/api/*` redirect at your Railway domain.
2. Import the repo in Netlify. The build settings come from `netlify.toml` (base `frontend`, command `npm run build`, publish `dist`).

**3. WhatsApp brief (optional)**

Until these are set, the WhatsApp brief page runs in preview mode: nothing leaves the app.

1. On [developers.facebook.com](https://developers.facebook.com), create an app, add the **WhatsApp** product and a business number. The free test number can message up to 5 phones you add under API Setup.
2. Add these variables on Railway (stockwaves → api → Variables):

| Variable | Description |
|----------|-------------|
| `WHATSAPP_TOKEN` | Permanent access token of a system user with `whatsapp_business_messaging` permission |
| `WHATSAPP_PHONE_NUMBER_ID` | The sending number's id from WhatsApp → API Setup (not the phone number) |
| `WHATSAPP_APP_SECRET` | App settings → Basic → App secret. Webhooks without a valid signature are rejected |
| `WHATSAPP_VERIFY_TOKEN` | Any phrase you choose; enter the same one in Meta's webhook setup |
| `WHATSAPP_BRIEF_TEMPLATE` | Optional: name of the approved template below |
| `WHATSAPP_TEMPLATE_LANG` | Template language code, default `en` |
| `WHATSAPP_GRAPH_VERSION` | Graph API version, default `v26.0` |

3. In Meta → WhatsApp → Configuration, set the callback URL to `https://<your-railway-domain>/api/v1/whatsapp/webhook` (the WhatsApp brief page shows it with a copy button), enter the verify token, and subscribe to `messages`.
4. Turn the brief on and add numbers on the WhatsApp brief page. Each person sends "hi" to the shop number once.

WhatsApp lets a business send free-form messages only within 24 hours of the person's last message. For other mornings, create a **Utility** template (WhatsApp Manager → Message templates), named e.g. `daily_brief`, with this body and two quick-reply buttons, **Show brief** and **Approve order**:

```
Good morning. Your StockWaves brief for {{1}}:
Stock at cost: {{2}}
Running out: {{3}}
Stuck 60+ days: {{4}}
Tap below to see the full brief or approve the reorder.
```

Without the template, a brief that falls outside the 24-hour window is marked as failed on the page, with the reason.

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
| `POST` | `/api/v1/assistant/plan` | Any | Understand a command and return a preview |
| `POST` | `/api/v1/assistant/actions/{id}/execute` | Any* | Run a previewed command (*stock, order and price actions need Admin/Manager) |
| `POST` | `/api/v1/assistant/actions/{id}/undo` | Any* | Undo a command |
| `GET` | `/api/v1/assistant/actions` | Any | Action log (staff see their own) |
| `GET` | `/api/v1/whatsapp/status` | Admin/Manager | WhatsApp mode, brief settings, recipients, webhook URL |
| `PUT` | `/api/v1/whatsapp/settings` | Admin | Brief on/off, time, days, language |
| `PUT` | `/api/v1/whatsapp/recipients/{user_id}` | Admin (or self) | WhatsApp number and brief opt-in |
| `POST` | `/api/v1/whatsapp/simulate` | Admin/Manager | Message or button tap from the in-app phone preview |
| `POST` | `/api/v1/whatsapp/brief/send` | Admin/Manager | Send today's brief now (preview or real) |
| `GET/POST` | `/api/v1/whatsapp/webhook` | Meta (signed) | Webhook verification and incoming messages |
| `POST` | `/api/v1/bills/scan` | Admin/Manager | Read a bill photo into a draft with matched lines |
| `PATCH` | `/api/v1/bills/{id}` | Admin/Manager | Edit a draft bill's supplier, matches, quantities and costs |
| `POST` | `/api/v1/bills/{id}/post` | Admin/Manager | Add the bill to stock through the ledger |
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
