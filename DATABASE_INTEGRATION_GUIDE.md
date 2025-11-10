# Database Integration Guide

This guide explains how to connect all features to the Supabase database.

## Step 1: Run Database Migration

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
4. Click **Run** to execute the migration
5. Verify all tables are created in the **Table Editor**

## Step 2: Update Components

All components have been updated to use the database helper functions from `lib/db-helpers.ts`. The following features now save to the database:

### ✅ Features Connected to Database

1. **Profile Management** (`app/profile/page.tsx`)
   - Saves profile updates to `user_profiles` table
   - Updates emergency contact information
   - Handles profile picture uploads

2. **Training Attendance** (`app/training/page.tsx`)
   - Creates training sessions in `training_sessions` table
   - Saves attendance records to `training_attendance` table
   - Loads existing sessions and attendance data

3. **Messages** (`app/messages/page.tsx`)
   - Sends messages to `messages` table
   - Loads messages for current user
   - Marks messages as read

4. **Inventory Management** (`app/inventory/page.tsx`)
   - Creates, updates, and deletes inventory items
   - Saves to `inventory` table
   - Loads inventory items from database

5. **Financial Transactions** (`app/finance/page.tsx`)
   - Creates revenue and expense transactions
   - Saves to `financial_transactions` table
   - Loads transactions with filtering

6. **Match Statistics** (`app/dashboard/data-admin/page.tsx`)
   - Creates matches in `matches` table
   - Saves player match stats to `match_stats` table

7. **Reports** (`app/reports/page.tsx`)
   - Creates report records in `reports` table
   - Updates report status

## Step 3: Testing

### Test Profile Updates
1. Login as any user
2. Go to Profile page
3. Click "Edit Profile"
4. Update phone, emergency contact
5. Click "Save Changes"
6. Verify data is saved in Supabase

### Test Training Attendance
1. Login as Coach or Data Admin
2. Go to Training page
3. Select a session
4. Mark attendance for players
5. Click "Save Attendance"
6. Verify in `training_attendance` table

### Test Messages
1. Login as any user
2. Go to Messages page
3. Click "New Message"
4. Compose and send a message
5. Verify in `messages` table

### Test Inventory
1. Login as Admin or Data Admin
2. Go to Inventory page
3. Click "Add Item"
4. Fill in item details
5. Click "Add Item"
6. Verify in `inventory` table

### Test Financial Transactions
1. Login as Finance Admin or Admin
2. Go to Finance page
3. Click "Add Revenue" or "Add Expense"
4. Fill in transaction details
5. Submit
6. Verify in `financial_transactions` table

## Step 4: Environment Variables

Ensure your `.env.local` file has:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Step 5: Row Level Security (RLS)

The migration includes RLS policies, but you may need to adjust them based on your requirements:

- **Players** can view/update their own data
- **Coaches** can view all players and manage training
- **Data Admins** can manage matches, stats, and inventory
- **Finance Admins** can manage financial transactions
- **Admins** have full access

## Troubleshooting

### "Permission denied" errors
- Check RLS policies in Supabase
- Verify user role in `user_profiles` table
- Ensure user is authenticated

### Data not saving
- Check browser console for errors
- Verify Supabase connection in `.env.local`
- Check RLS policies allow INSERT/UPDATE

### Tables not found
- Run the migration SQL file
- Verify tables exist in Supabase Table Editor

## Next Steps

1. ✅ Run database migration
2. ✅ Test each feature
3. ✅ Verify data persistence
4. ✅ Adjust RLS policies if needed
5. ✅ Set up authentication (if not already done)

