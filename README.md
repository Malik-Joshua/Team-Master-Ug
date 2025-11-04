# Mongers Rugby Club Management Web Application

A comprehensive full-stack web application for managing player registration, performance tracking, team analytics, financial operations, and club inventory for Mongers Rugby Club.

## 🚀 Tech Stack

- **Frontend**: Next.js 14+ (App Router) with React 18
- **Backend**: Next.js API Routes with Node.js/Express patterns
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Charts**: Chart.js with react-chartjs-2
- **Excel Handling**: xlsx
- **AI Chatbot**: xAI API (Grok)
- **Deployment**: Vercel

## 📋 Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase account and project
- xAI API key (for Grok chatbot)

## 🛠️ Setup Instructions

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# xAI API Configuration (for Grok chatbot)
XAI_API_KEY=your_xai_api_key

# Next.js Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Important**: 
- Replace `your_supabase_project_url` with your Supabase project URL
- Replace `your_supabase_anon_key` with your Supabase anonymous key
- Replace `your_supabase_service_role_key` with your Supabase service role key (keep this secret!)
- Replace `your_xai_api_key` with your xAI API key
- For production, update `NEXT_PUBLIC_APP_URL` to your production domain

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production

```bash
npm run build
npm start
```

## 🚀 Deployment on Vercel

### Automatic Deployment

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
2. Import your repository in [Vercel](https://vercel.com)
3. Add your environment variables in Vercel's project settings:
   - Go to Settings → Environment Variables
   - Add all variables from `.env.local`
4. Deploy!

### Manual Deployment

```bash
npm install -g vercel
vercel
```

Follow the prompts and add your environment variables when prompted.

## 📁 Project Structure

```
TeamMaster/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── lib/                   # Utility functions and configurations
│   └── supabase/          # Supabase client setup
│       ├── client.ts      # Browser client
│       ├── server.ts      # Server client
│       └── middleware.ts  # Middleware for auth
├── components/             # React components (to be created)
├── middleware.ts          # Next.js middleware
├── public/                # Static assets
├── .env.local             # Environment variables (not in git)
├── next.config.js         # Next.js configuration
├── tailwind.config.ts     # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies
```

## 🔐 Security Notes

- Never commit `.env.local` to version control
- The `.gitignore` file is configured to exclude environment files
- Use Supabase Row Level Security (RLS) policies for data access control
- Service role key should only be used in server-side code

## 📝 Features (To Be Implemented)

- ✅ Project setup with Next.js and Supabase
- ⏳ User authentication and role-based access control
- ⏳ Player registration and profile management
- ⏳ Performance tracking and analytics
- ⏳ Financial management
- ⏳ Inventory management
- ⏳ AI chatbot integration (Grok)
- ⏳ Notifications system
- ⏳ Excel import/export functionality

## 🧪 Development

- **Linting**: `npm run lint`
- **Type Checking**: TypeScript is configured with strict mode

## 📚 Documentation

For more information on:
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Chart.js Documentation](https://www.chartjs.org/docs)

## 👥 Contributors

- Malik - Initial development

## 📄 License

This project is proprietary software for Mongers Rugby Club.

---

**Note**: Make sure to set up your Supabase database schema and RLS policies according to the requirements document before deploying to production.



