# Database Schema for Mongers Rugby Club Management System

This document outlines the Supabase database schema required for the application.

## Tables

### 1. user_profiles

Stores user information and role assignments.

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  unique_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('player', 'coach', 'data_admin', 'finance_admin', 'admin')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'injured')),
  emergency_contact TEXT,
  emergency_phone TEXT,
  profile_picture_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_status ON user_profiles(status);
```

### 2. players

Extended player-specific information.

```sql
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE UNIQUE NOT NULL,
  position TEXT NOT NULL CHECK (position IN (
    'prop', 'hooker', 'lock', 'flanker', '8th_man',
    'scrum_half', 'fly_half', 'inside_center', 'outside_center', 'winger'
  )),
  category TEXT NOT NULL CHECK (category IN ('forwards', 'backs')),
  jersey_number INTEGER,
  date_of_birth DATE,
  height_cm INTEGER,
  weight_kg DECIMAL(5,2),
  gym_stats JSONB DEFAULT '{}', -- { "squat_pb": 100, "bench_press_pb": 80, ... }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_players_user_id ON players(user_id);
CREATE INDEX idx_players_position ON players(position);
CREATE INDEX idx_players_category ON players(category);
```

### 3. matches

Match information and results.

```sql
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_date DATE NOT NULL,
  opponent TEXT NOT NULL,
  tournament_type TEXT NOT NULL CHECK (tournament_type IN ('uganda_cup', 'league', 'sevens', 'friendly')),
  venue TEXT,
  result TEXT CHECK (result IN ('win', 'loss', 'draw')),
  score_our_team INTEGER DEFAULT 0,
  score_opponent INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_matches_date ON matches(match_date);
CREATE INDEX idx_matches_tournament ON matches(tournament_type);
```

### 4. match_stats

Individual player statistics per match.

```sql
CREATE TABLE match_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES players(user_id) ON DELETE CASCADE NOT NULL,
  tackles_made INTEGER DEFAULT 0,
  tackles_missed INTEGER DEFAULT 0,
  ball_handling_errors INTEGER DEFAULT 0,
  carries INTEGER DEFAULT 0,
  tries_scored INTEGER DEFAULT 0,
  minutes_played INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, player_id)
);

CREATE INDEX idx_match_stats_match ON match_stats(match_id);
CREATE INDEX idx_match_stats_player ON match_stats(player_id);
```

### 5. training_sessions

Training session information.

```sql
CREATE TABLE training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date DATE NOT NULL,
  session_time TIME,
  location TEXT,
  description TEXT,
  coach_id UUID REFERENCES user_profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_training_sessions_date ON training_sessions(session_date);
CREATE INDEX idx_training_sessions_coach ON training_sessions(coach_id);
```

### 6. training_attendance

Player attendance records for training sessions.

```sql
CREATE TABLE training_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES players(user_id) ON DELETE CASCADE NOT NULL,
  attendance_status TEXT NOT NULL CHECK (attendance_status IN ('present', 'justified_absence', 'unjustified_absence', 'injured')),
  notes TEXT,
  recorded_by UUID REFERENCES user_profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, player_id)
);

CREATE INDEX idx_training_attendance_session ON training_attendance(session_id);
CREATE INDEX idx_training_attendance_player ON training_attendance(player_id);
```

### 7. financial_transactions

Financial transactions (expenses and revenues).

```sql
CREATE TABLE financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'revenue')),
  category TEXT NOT NULL, -- 'match_day', 'player_treatment', 'training', 'membership_fee', 'sponsorship', etc.
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_by UUID REFERENCES user_profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_financial_transactions_date ON financial_transactions(transaction_date);
CREATE INDEX idx_financial_transactions_type ON financial_transactions(type);
```

### 8. inventory

Club inventory/equipment management.

```sql
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  category TEXT, -- 'equipment', 'jersey', 'gear', etc.
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price DECIMAL(10,2),
  description TEXT,
  created_by UUID REFERENCES user_profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inventory_category ON inventory(category);
```

### 9. notifications

System notifications for users.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
```

### 10. messages

Messages between players, coaches, and admins.

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
```

### 11. uploaded_files

File uploads (photos, documents, etc.).

```sql
CREATE TABLE uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  category TEXT, -- 'profile_picture', 'document', 'training_plan', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_uploaded_files_user ON uploaded_files(user_id);
CREATE INDEX idx_uploaded_files_category ON uploaded_files(category);
```

## Row Level Security (RLS) Policies

Enable RLS on all tables:

```sql
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
```

### Example RLS Policies

```sql
-- Players can view their own profile
CREATE POLICY "Players can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Players can update their own profile
CREATE POLICY "Players can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Similar policies needed for all tables based on role requirements
```

## Functions

### Update updated_at timestamp

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables with updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Repeat for other tables...
```

## Setup Instructions

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the CREATE TABLE statements above
4. Run the RLS policies (customize based on your security requirements)
5. Create the trigger functions
6. Set up Storage buckets for file uploads:
   - `profile-pictures` (public)
   - `documents` (authenticated)
   - `training-plans` (authenticated)

