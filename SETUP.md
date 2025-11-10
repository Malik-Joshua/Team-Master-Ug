# Mongers Rugby Club Management System - Setup Guide

## Quick Start

### 1. Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
XAI_API_KEY=your_xai_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Database Setup

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run all the SQL commands from `DATABASE_SCHEMA.md`
4. Set up Storage buckets:
   - `profile-pictures` (public read, authenticated write)
   - `documents` (authenticated only)
   - `training-plans` (authenticated only)

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## Features Implemented

✅ **Authentication System**
- Login page with email/password
- Registration page with role selection
- Auto-generated unique IDs
- Role-based access control

✅ **Role-Based Dashboards**
- Player dashboard
- Coach dashboard
- Admin dashboard
- Data Admin dashboard
- Finance Admin dashboard

✅ **User Management**
- Profile pages with editing
- Profile picture uploads
- Role-specific views

✅ **Navigation System**
- Dynamic navigation based on user role
- Mobile-responsive layout
- Beautiful UI with club branding

## Next Steps - Pages to Complete

The following pages need to be created (structure is ready):

1. **Players Management** (`/app/players/page.tsx`)
   - List all players
   - Filter by position, category, status
   - View/edit player profiles
   - Admin approval for player registrations

2. **Match Management** (`/app/matches/page.tsx`)
   - Log new matches
   - Enter match statistics per player
   - View match history
   - Tournament filtering

3. **Training Management** (`/app/training/page.tsx`)
   - Schedule training sessions
   - Record attendance
   - View training history

4. **Performance Tracking** (`/app/performance/page.tsx`)
   - Individual player stats
   - Team analytics
   - Charts and visualizations
   - Gym stats tracking

5. **Financial Management** (`/app/finance/page.tsx`)
   - Log expenses
   - Log revenue
   - Financial summaries
   - Excel import/export

6. **Inventory Management** (`/app/inventory/page.tsx`)
   - Add/edit items
   - Track quantities
   - Search and filter

7. **Messages** (`/app/messages/page.tsx`)
   - Send messages to admin/coach
   - View received messages
   - Availability updates
   - Injury reports

8. **AI Chatbot** (`/app/chatbot/page.tsx`)
   - Grok AI integration
   - Query performance data
   - Club information

9. **Notifications** (integrated in Layout)
   - Real-time notifications
   - Match day alerts
   - Training reminders

10. **Reports** (`/app/reports/page.tsx`)
    - Generate reports
    - Excel export
    - Data visualization

## Role Permissions Summary

### Player
- View own profile
- Edit own profile
- View own performance stats
- Upload profile picture
- Send messages to admin/coach
- Access chatbot

### Coach
- View all players
- Schedule training
- Record attendance
- View team performance
- Send messages

### Data Admin
- Log match statistics
- Record training attendance
- View all player data
- Edit match/training data

### Finance Admin
- Log expenses/revenue
- View financial summaries
- Export financial reports

### General Admin
- Full access to all features
- Manage user roles
- Approve player registrations
- Edit all data

## UI Design Features

- Beautiful gradient theme (blue to red - club colors)
- Responsive design (mobile-first)
- Modern card-based layouts
- Interactive elements with hover effects
- Icon-based navigation (Lucide React)
- Loading states and error handling
- Form validation

## Security

- Row Level Security (RLS) on all tables
- Role-based access control
- Secure file uploads
- Password validation
- Protected routes

## Deployment

1. Push code to GitHub
2. Connect to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

## Notes

- All authentication is handled via Supabase Auth
- File uploads use Supabase Storage
- Real-time features can be added using Supabase Realtime
- Excel import/export uses the `xlsx` library
- Charts use Chart.js (already in dependencies)

