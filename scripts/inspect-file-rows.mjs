// Read-only diagnostic: checks whether `rows` is stored for uploaded files.
// Usage: node scripts/inspect-file-rows.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

for (const table of ['gym_metric_files', 'training_attendance_files']) {
  const { data, error } = await supabase
    .from(table)
    .select('id, file_name, session_id, uploaded_at, rows')
    .order('uploaded_at', { ascending: false })
    .limit(10)

  console.log(`\n=== ${table} ===`)
  if (error) { console.log('ERROR:', error.code, error.message); continue }
  if (!data?.length) { console.log('(no records)'); continue }
  for (const f of data) {
    const n = Array.isArray(f.rows) ? f.rows.length : (f.rows === null ? 'NULL' : typeof f.rows)
    console.log(`${f.uploaded_at?.slice(0,10)}  ${f.file_name.padEnd(28)} rows=${n}`)
  }
}
