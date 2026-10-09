// One-off: create a Fly Half (#10) player account in Supabase.
// Run with: node scripts/create-fly-half.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const i = line.indexOf('=')
      return [line.slice(0, i), line.slice(i + 1).replace(/^["']|["']$/g, '')]
    })
)

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const EMAIL    = 'flyhalf@teammaster.dev'
const PASSWORD = 'password123'
const NAME     = 'Fly Half #10'

// 1. Create or reuse auth user
let user
const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 })
const existing = listData?.users?.find(u => u.email?.toLowerCase() === EMAIL)
if (existing) {
  await admin.auth.admin.updateUserById(existing.id, { password: PASSWORD, email_confirm: true })
  user = existing
  console.log(`✓ Auth user already exists (${EMAIL}) — password reset`)
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  })
  if (error) throw error
  user = data.user
  console.log(`✓ Auth user created (${EMAIL})`)
}

// 2. user_profiles row
const { data: existingProfile } = await admin
  .from('user_profiles')
  .select('id')
  .eq('user_id', user.id)
  .maybeSingle()

if (!existingProfile) {
  const uniqueId = `PLR${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  const { error } = await admin.from('user_profiles').insert({
    user_id: user.id,
    unique_id: uniqueId,
    name: NAME,
    email: EMAIL,
    role: 'player',
    status: 'active',
  })
  if (error) throw error
  console.log(`✓ user_profiles row created`)
} else {
  console.log(`  user_profiles already exists`)
}

// 3. players row (position + jersey number)
const { data: existingPlayer } = await admin
  .from('players')
  .select('id')
  .eq('user_id', user.id)
  .maybeSingle()

if (!existingPlayer) {
  const { error } = await admin.from('players').insert({
    user_id: user.id,
    position: 'fly_half',
    jersey_number: 10,
    category: 'backs',
  })
  if (error) throw error
  console.log(`✓ players row created — fly_half #10`)
} else {
  // Make sure position is set even if row already exists
  const { error } = await admin
    .from('players')
    .update({ position: 'fly_half', jersey_number: 10, category: 'backs' })
    .eq('user_id', user.id)
  if (error) throw error
  console.log(`  players row updated — fly_half #10`)
}

console.log()
console.log(`Done.`)
console.log(`  Email:    ${EMAIL}`)
console.log(`  Password: ${PASSWORD}`)
console.log(`  Position: Fly Half (#10)`)
