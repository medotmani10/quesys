# ✂️ Barber Ticket — نظام إدارة الصالونات الرقمي

<p align="center">
  <strong>A premium, real-time queue management SaaS for barbershops — built mobile-first with Arabic RTL support.</strong>
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white&style=flat-square">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white&style=flat-square">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white&style=flat-square">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white&style=flat-square">
  <img alt="PWA" src="https://img.shields.io/badge/PWA-Installable-5A0FC8?logo=pwa&logoColor=white&style=flat-square">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square">
</p>

---

## 📖 Overview

**Barber Ticket** is a full-stack SaaS queue management system designed specifically for barbershops. It replaces physical ticketing machines with a smart digital platform: shop owners manage their queue from an installed PWA, while customers join and track their position in real time by scanning a QR code or visiting the shop's unique URL — no app download required.

---

## ✨ Key Features

### 🪑 For Shop Owners (Admin PWA)
| Feature | Description |
|---|---|
| **Barber Dashboard** | One card per barber — shows currently serving ticket and full waiting list |
| **Per-Barber Queues** | Each barber has an independent queue and ticket sequence |
| **Manual Ticket Creation** | Instantly add walk-in customers with barber assignment |
| **Next Customer Button** | Calls the next waiting customer for each barber with one tap |
| **Finish & Cancel** | Complete or cancel any active ticket at any time |
| **Shop Open/Close Toggle** | Instantly opens or closes accepting new bookings |
| **All Tickets View** | Unified list of all active tickets across all barbers |
| **Archive** | Full history of completed and canceled tickets |
| **Thermal Print + PDF** | Print tickets on 58mm thermal printers; auto-downloads PDF copy |
| **Real-time Sync** | Dashboard updates live via Supabase Realtime — no refresh needed |
| **Settings** | Edit shop name, slug, logo, maps link, phone number |

### 📱 For Customers (Web Browser)
| Feature | Description |
|---|---|
| **Barber Selection** | Mandatory — visual buttons showing each barber and live queue count |
| **Per-Barber Ticket Codes** | Each ticket gets a prefixed code (e.g. `A001` for Ahmed, `M001` for Mohamed) |
| **Live Queue Position** | See exactly how many people are ahead at their chosen barber |
| **Real-time Status** | Instant notification when it's their turn |
| **Ticket Tracking via QR** | Scan the printed ticket's QR → direct link to their ticket status page |
| **Cancel Ticket** | Cancel their booking at any time while waiting |
| **No Double Booking** | System prevents creating a second ticket while one is active |

---

## 🏗️ Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Vite + React)              │
│  ┌─────────────────┐          ┌─────────────────────┐   │
│  │  Customer Web   │          │    Admin PWA         │   │
│  │  /:slug         │          │  /admin (standalone) │   │
│  │  /t/:ticketId   │          │  /admin/archive      │   │
│  └────────┬────────┘          └──────────┬──────────┘   │
└───────────┼───────────────────────────────┼──────────────┘
            │ Supabase JS Client (REST + WS) │
┌───────────▼───────────────────────────────▼──────────────┐
│                      Supabase (BaaS)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │
│  │PostgreSQL│  │ Realtime │  │   Auth   │  │ Storage │  │
│  │  tables  │  │ channels │  │  (email) │  │(logos)  │  │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘  │
└───────────────────────────────────────────────────────────┘
```

| Layer | Technology |
|---|---|
| **Framework** | React 18 + TypeScript |
| **Build Tool** | Vite 7 |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Backend / Database** | Supabase (PostgreSQL + Realtime + Auth + Storage) |
| **Routing** | React Router DOM v6 |
| **Notifications** | Sonner (toast) |
| **QR Code** | qrcode.react |
| **PDF Generation** | html2pdf.js |
| **PWA** | vite-plugin-pwa (workbox) |
| **Icons** | Lucide React |

---

## 🗺️ Routes

| Path | Access | Description |
|---|---|---|
| `/` | Public | Landing page + auth (login/signup) |
| `/:slug` | Web only | Customer booking page for a specific shop |
| `/t/:ticketId` | Public | Direct ticket status page (QR code target) |
| `/onboarding` | Auth required | Initial shop setup wizard |
| `/admin` | Auth required (PWA) | Main admin dashboard |
| `/admin/archive` | Auth required (PWA) | Ticket history |
| `/admin/settings` | Auth required (PWA) | Shop settings |

> **Note:** Customers access `/:slug` via browser link. The installed PWA automatically redirects to `/admin` ensuring admins use the app and customers use the browser.

---

## 🗄️ Database Schema

### `shops`
```sql
id          uuid PRIMARY KEY
owner_id    uuid REFERENCES auth.users
slug        text UNIQUE          -- used in the public booking URL
name        text
logo_url    text (nullable)
maps_url    text (nullable)
phone       text (nullable)
is_open     boolean DEFAULT true
created_at  timestamptz
```

### `barbers`
```sql
id          uuid PRIMARY KEY
shop_id     uuid REFERENCES shops
name        text
is_active   boolean DEFAULT true
created_at  timestamptz
```

### `tickets`
```sql
id               uuid PRIMARY KEY
shop_id          uuid REFERENCES shops
barber_id        uuid REFERENCES barbers  -- always assigned (mandatory)
customer_name    text
phone_number     text
people_count     integer DEFAULT 1
ticket_number    integer              -- sequential per shop per day
user_session_id  text                 -- prevents duplicate bookings
status           enum(waiting, serving, completed, canceled)
created_at       timestamptz
updated_at       timestamptz
```

### Key Stored Procedures
| Procedure | Purpose |
|---|---|
| `get_next_ticket_number(p_shop_id)` | Returns the next sequential ticket number for today |
| `process_next_customer(p_barber_id, p_shop_id)` | Atomically marks current ticket as complete and promotes next waiting customer; uses `FOR UPDATE SKIP LOCKED` to prevent race conditions |

---

## 🎫 Ticket Code System

Every ticket gets a **per-barber display code** derived at render time:

```
Barber "Ahmed"   → prefix "A" → ticket 1  → A001
Barber "Mohamed" → prefix "M" → ticket 14 → M014
Barber "Youssef" → prefix "Y" → ticket 3  → Y003
```

The code is computed client-side from the barber's name initial + zero-padded ticket number. No database schema change required.

---

## 🖨️ Thermal Print & PDF

When a ticket is printed from the admin dashboard:
1. A **58mm thermal-width** print window opens and auto-triggers `window.print()`
2. Simultaneously, a **PDF is downloaded** automatically (filename: `تذكرة-A001-محمد.pdf`)
3. The **QR code** on the ticket links to `/t/:ticketId` — when scanned, the customer sees their live ticket status directly, with cancel option and realtime updates

---

## 🔐 Security

- **Row Level Security (RLS)** enabled on all tables
- Shop owners can only read/write their own shop's data
- Customers interact only through anon key (read public shop data, insert tickets)
- Session-based duplicate prevention (one active ticket per session)
- Race condition protection via `FOR UPDATE SKIP LOCKED` in SQL stored procedures

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- A [Supabase](https://supabase.com) project

### 1. Clone & Install
```bash
git clone https://github.com/medotmani10/quesys.git
cd quesys
npm install
```

### 2. Environment Variables
```bash
cp .env.example .env
```
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Database Setup
Run the following SQL files in your Supabase SQL Editor **in order**:
```
supabase/schema.sql          ← tables, RLS policies, stored procedures
supabase/enable_realtime.sql ← enables Realtime on tickets table
supabase/storage_bucket.sql  ← creates shop-logos storage bucket
```

### 4. Run Locally
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
```

### 6. Deploy
The project includes `vercel.json` and `netlify.toml` for one-click deployment. For SPA routing to work correctly, ensure your hosting platform serves `index.html` for all routes — both config files handle this automatically.

---

## 📱 PWA Installation

The admin interface is designed as an installable PWA:
- On Android/Chrome: **Add to Home Screen** from the browser menu
- On iOS/Safari: **Share → Add to Home Screen**
- On Desktop: install icon in the address bar

Once installed, the PWA opens in standalone mode (no browser UI) and automatically routes to `/admin`.

---

## 🎨 Design Language

- **Color palette**: Black (`#000`) + Yellow (`#facc15`) + Zinc grays — premium barbershop aesthetic
- **Typography**: Cairo + Noto Kufi Arabic (Google Fonts)
- **Direction**: Full RTL (Arabic-first)
- **Animations**: `animate-in`, `fade-in`, `slide-in` for all tab/page transitions
- **Cards**: `rounded-2xl` with subtle yellow glow on hover
- **Mobile-first**: Tested on 360px minimum viewport

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

<p align="center">Built with ❤️ for barbershops — by Mohamed Otmani</p>