# Setup: Staff Attendance at Training Sessions

Training sessions only ever recorded **player** attendance. Staff attendance was
never stored anywhere, so every staff-facing "training sessions attended" stat
had to approximate it — coaches counted the sessions they *owned*
(`training_sessions.coach_id`), and the physio counted *every* session the club
had ever held. Neither is attendance.

Migration `060_training_staff_attendance.sql` adds the training-session
equivalent of the existing `match_staff_attendance` table so those stats read
from real recorded presence.

## Run the migration

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `supabase/migrations/060_training_staff_attendance.sql`
5. Click **Run** (or press Cmd/Ctrl + Enter)

## Before you run it

The app degrades gracefully — nothing breaks if the migration hasn't been run:

- The **Staff Attendance** panel on the training attendance sheet shows a notice
  telling you to run this migration.
- Player attendance still saves normally; only the staff portion is skipped, and
  the save confirmation says so.
- Staff "training sessions attended" stats read `0` instead of erroring.

## After you run it

- A **Staff Attendance** panel appears at the bottom of the training attendance
  sheet, once a session is selected. Staff default to **present**, so you only
  untick whoever missed the session.
- It saves together with player attendance when you press **Save Attendance**.
- These stats now come from the recorded data:
  - Coach dashboard → *Training Sessions*
  - Physio dashboard → *Training Sessions Attended*

## What it creates

`training_staff_attendance`, mirroring `match_staff_attendance`:

| column | notes |
| --- | --- |
| `session_id` | FK → `training_sessions(id)`, cascade delete |
| `staff_id` | FK → `user_profiles(user_id)`, cascade delete |
| `attendance_status` | `'P'` or `'A'` |
| `recorded_by` | who saved the sheet |

Unique on `(session_id, staff_id)` so re-saving a sheet updates rather than
duplicates. RLS lets staff read their own row, lets anyone who can already see
the attendance sheet read the rest, and restricts writes to
`admin` / `coach` / `asst_coach` / `data_admin`.
