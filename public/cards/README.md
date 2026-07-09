# Role cards

Card artwork (JPEG) shown on a user's own profile via `components/RoleCard.tsx`.
Files are named by the position slug (or `coach`) so the mapping is automatic.

| # | Role / position    | File                     | Status |
| - | ------------------ | ------------------------ | ------ |
| 1 | Loosehead Prop     | `loosehead_prop.jpg`     | ✅ |
| 2 | Hooker             | `hooker.jpg`             | ✅ |
| 3 | Tighthead Prop     | `tighthead_prop.jpg`     | ✅ |
| 4/5 | Locks            | `lock.jpg`               | ✅ |
| 6 | Blindside Flanker  | `blindside_flanker.jpg`  | ✅ |
| 7 | Openside Flanker   | `openside_flanker.jpg`   | ✅ |
| 8 | Number Eight       | `8th_man.jpg`            | ✅ |
| 9 | Scrum-Half         | `scrum_half.jpg`         | ✅ |
| 10 | Fly-Half          | `fly_half.jpg`           | ✅ |
| 11 | Left Wing         | `left_wing.jpg`          | ✅ |
| 12 | Inside Center     | `inside_center.jpg`      | ✅ |
| 13 | Outside Center    | `outside_center.jpg`     | ✅ |
| 14 | Right Wing        | `right_wing.jpg`         | ✅ |
| 15 | Full-Back         | `full_back.jpg`          | ✅ |
| — | Coach              | `coach.jpg`              | ✅ |

Notes:
- Legacy data values `prop`, `flanker`, `winger` still exist; the app maps them
  to `loosehead_prop`, `blindside_flanker`, `left_wing` respectively for display.
- Adding new position values requires the DB constraint from
  `supabase/migrations/041_expand_player_positions.sql` to be applied.
- Missing files render a labelled placeholder instead of breaking.
- Edit `title` / `tagline` copy per position in `components/RoleCard.tsx`.
