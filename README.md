# BarberQueue - نظام إدارة مصففات الشعر

A premium, mobile-first SaaS platform for Men's Barbershops to manage queues efficiently.

## 🚀 Live Demo

**URL:** https://zzq3wbfxxaeik.ok.kimi.link

## ✨ Features

### For Shop Owners (Admin Dashboard)
- **Shop Management**: Control shop open/closed status
- **Queue Management**: Kanban-style board for each barber/chair
- **Manual Ticket Creation**: Add walk-in customers instantly
- **Real-time Updates**: Live sync across all devices
- **Archive**: View completed/canceled tickets history
- **Smart "Next" Logic**: Automatically assigns customers from general queue or specific barber queue
- **Race Condition Protection**: Stored procedure ensures no double-assignment

### For Customers
- **Easy Booking**: Simple form to join the queue
- **Real-time Tracking**: See position in queue, people ahead
- **Barber Selection**: Choose specific barber or any available
- **Live Status Updates**: Get notified when it's their turn
- **No Double Booking**: System prevents multiple active tickets

### Technical Features
- **Mobile-First Design**: Optimized for smartphones
- **iOS Native Style**: Glassmorphism, rounded corners, soft shadows
- **RTL Arabic Support**: Full right-to-left layout
- **Supabase Integration**: PostgreSQL, Auth, Real-time, Storage
- **Row Level Security**: Secure data access with RLS policies

## 🛠 Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Real-time, Storage)
- **Routing**: React Router DOM
- **Bottom Sheets**: Vaul

## 📱 Screens

### Public Pages
- `/` - Landing Page with Auth
- `/:slug` - Customer Booking Page (Shop-specific)

### Protected Pages
- `/onboarding` - Shop Setup (first-time users)
- `/admin` - Admin Dashboard
- `/admin/archive` - Tickets History

## 🗄 Database Schema

### Shops Table
```sql
- id (uuid, primary key)
- owner_id (uuid, references auth.users)
- slug (text, unique)
- name (text)
- logo_url (text, nullable)
- maps_url (text, nullable)
- is_open (boolean, default: true)
```

### Barbers Table
```sql
- id (uuid, primary key)
- shop_id (uuid, foreign key)
- name (text)
- is_active (boolean, default: true)
```

### Tickets Table
```sql
- id (uuid, primary key)
- shop_id (uuid, foreign key)
- barber_id (uuid, nullable, foreign key)
- customer_name (text)
- phone_number (text)
- people_count (integer, default: 1)
- ticket_number (integer)
- user_session_id (text)
- status (enum: waiting, serving, completed, canceled)
- created_at (timestampz)
```

## 🔧 Setup Instructions

### 1. Create Supabase Project
1. Go to [Supabase](https://supabase.com) and create a new project
2. Copy your project URL and anon key

### 2. Configure Environment Variables
Create `.env` file:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Run Database Migrations
Execute the SQL in `supabase/schema.sql` in your Supabase SQL Editor:
- Creates tables with proper relationships
- Sets up RLS policies
- Creates stored procedures for ticket numbering and next customer logic

### 4. Setup Storage Bucket
1. Go to Storage in Supabase Dashboard
2. Create a new bucket named `shop-logos`
3. Set it as public
4. Add the RLS policies from schema.sql

### 5. Install Dependencies
```bash
npm install
```

### 6. Run Development Server
```bash
npm run dev
```

### 7. Build for Production
```bash
npm run build
```

## 🔐 Security Features

- **Row Level Security (RLS)**: All tables have RLS enabled
- **Shop Owner Verification**: Only shop owners can modify their data
- **Session-based Customer Tracking**: Prevents duplicate tickets
- **Race Condition Protection**: Stored procedure with `FOR UPDATE SKIP LOCKED`

## 🎯 Key Stored Procedures

### get_next_ticket_number(p_shop_id)
Returns the next sequential ticket number for a shop (per day).

### process_next_customer(p_barber_id, p_shop_id)
Handles the "Next Customer" logic:
1. Completes current serving ticket
2. Finds oldest waiting ticket for specific barber
3. If none, finds from general queue
4. Updates status to 'serving'
5. Uses `FOR UPDATE SKIP LOCKED` to prevent race conditions

## 📱 Mobile Optimization

- Touch-friendly buttons (min 44px)
- Bottom sheets for forms (iOS-style)
- Responsive cards and layouts
- Safe area insets support
- Smooth animations

## 🎨 Design System

- **Colors**: Blue primary (#3B82F6), slate grays
- **Border Radius**: 3xl (1.5rem) for cards, 2xl (1rem) for buttons
- **Shadows**: Soft, layered shadows for depth
- **Typography**: System fonts, Arabic support

## 📝 License

MIT License - Feel free to use and modify!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For support, email support@barberqueue.com or open an issue on GitHub.

---

**Made with ❤️ for barbershops worldwide**