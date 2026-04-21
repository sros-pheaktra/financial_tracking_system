# FinTrack — Financial Dashboard

A responsive, production-ready financial tracking app built with **Vanilla JS**, **CSS Custom Properties**, and **Supabase** as the backend.

---

## 📁 Project Structure

```
fintrack/
├── index.html                   ← App entry point
├── supabase_schema.sql          ← Full Supabase DB schema (run this first)
│
├── css/
│   └── styles.css               ← Design system, themes, all component styles
│
└── js/
    ├── app.js                   ← Bootstrap, routing, settings page
    │
    ├── services/
    │   └── supabase.js          ← Supabase client + all CRUD helpers
    │
    ├── utils/
    │   ├── state.js             ← Reactive global state store
    │   └── helpers.js           ← Formatters, date utils, misc helpers
    │
    └── components/
        ├── Auth.js              ← Login / signup pages
        ├── Sidebar.js           ← Collapsible navigation sidebar
        ├── Topbar.js            ← Header bar with search + theme toggle
        ├── Dashboard.js         ← Main dashboard (stats, charts, transactions)
        ├── TransactionModal.js  ← Add / edit transaction modal
        ├── Charts.js            ← Canvas-based chart renderers (line, bar, donut, sparkline)
        └── Toast.js             ← Notification toasts
```

---

## 🗄️ Supabase Tables

| Table            | Description                                      |
|------------------|--------------------------------------------------|
| `profiles`       | User settings (budget, savings goal, theme)      |
| `categories`     | Income/expense categories (system + user-defined)|
| `accounts`       | Bank accounts, wallets, credit cards             |
| `transactions`   | All financial transactions                       |
| `budgets`        | Monthly/weekly budget limits per category        |
| `savings_goals`  | Personal savings targets with progress tracking  |

---

## ⚙️ Setup

### 1. Create Supabase project
1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In the SQL Editor, paste and run **`supabase_schema.sql`**.
3. Enable **Email Auth** under Authentication → Providers.

### 2. Configure environment
Open `js/services/supabase.js` and replace:
```js
const SUPABASE_URL     = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```
Find these in your Supabase project under **Settings → API**.

### 3. Run locally
Since the app uses ES modules, serve it from a local server:

```bash
# Option A: Python
python3 -m http.server 3000

# Option B: Node.js
npx serve .

# Option C: VS Code Live Server extension
```

Open **http://localhost:3000**.

---

## ✨ Features

- **Authentication** — Email/password signup & login via Supabase Auth
- **Dashboard** — Real-time stats: total balance, monthly income, expenses, savings
- **Charts** — Line chart (income vs expenses), bar chart (cash flow), donut (spending breakdown), mini sparklines — all drawn with Canvas API (no external chart library)
- **Transactions** — Full CRUD, filter by type, search, click to edit
- **Budget Planner** — Monthly budgets per category with progress bars
- **Savings Goals** — Track progress toward financial targets
- **Light / Dark Mode** — Full theme system via CSS custom properties, persisted to localStorage
- **Responsive** — Works on mobile, tablet, and desktop
- **Real-time ready** — Supabase Realtime can be enabled to push live updates

---

## 🎨 Design System

| Token                | Light            | Dark             |
|----------------------|------------------|------------------|
| `--bg-app`           | `#F4F5F9`        | `#0D0F14`        |
| `--bg-card`          | `#FFFFFF`        | `#161922`        |
| `--accent`           | `#FF4444`        | `#FF4444`        |
| `--income`           | `#10B981`        | `#10B981`        |
| `--expense`          | `#F43F5E`        | `#F43F5E`        |
| Font (display)       | Syne             | Syne             |
| Font (body)          | DM Sans          | DM Sans          |

---

## 🔒 Security

- All tables use **Row Level Security (RLS)** — users can only access their own data.
- Auth is handled entirely by Supabase — passwords are never stored in app code.
- The anon key is safe to expose client-side (it only unlocks RLS-gated data).

---

## 🚀 Extending

| Feature               | Where to add                          |
|-----------------------|---------------------------------------|
| Accounts page         | `js/components/AccountsPage.js`       |
| Analytics page        | `js/components/AnalyticsPage.js`      |
| CSV export            | `js/utils/export.js`                  |
| Recurring transactions| Add `recurring` flag to `transactions`|
| Push notifications    | Supabase Edge Functions + Web Push    |
| Multi-currency        | Add `fx_rate` to `transactions`       |
