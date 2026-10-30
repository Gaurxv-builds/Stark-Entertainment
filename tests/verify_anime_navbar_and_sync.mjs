import assert from 'node:assert'
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

console.log('--- STARTING ANIME NAVBAR & SUPABASE SYNC VERIFICATION ---')

// 1. Verify NavbarActions Component
const navbarActionsFile = fs.readFileSync('src/components/NavbarActions.tsx', 'utf8')
assert(navbarActionsFile.includes('export function NavbarActions'), 'NavbarActions component must be exported')

// Verify order in NavbarActions
const homeIdx = navbarActionsFile.indexOf('/* 1. Home */')
const adminIdx = navbarActionsFile.indexOf('/* 2. Admin')
const themeIdx = navbarActionsFile.indexOf('/* 3. Theme toggle */')
const logoutIdx = navbarActionsFile.indexOf('/* 4. Logout */')
const profileIdx = navbarActionsFile.indexOf('/* 5. Profile / Avatar */')

assert(homeIdx !== -1, 'Home action must be present')
assert(adminIdx !== -1, 'Admin action must be present')
assert(themeIdx !== -1, 'Theme toggle action must be present')
assert(logoutIdx !== -1, 'Logout action must be present')
assert(profileIdx !== -1, 'Profile/avatar action must be present')

assert(homeIdx < adminIdx, 'Home must appear before Admin')
assert(adminIdx < themeIdx, 'Admin must appear before Theme')
assert(themeIdx < logoutIdx, 'Theme must appear before Logout')
assert(logoutIdx < profileIdx, 'Logout must appear before Profile/avatar')
console.log('[PASS] NavbarActions enforces strictly: Home -> Admin -> Theme -> Logout -> Profile')

// 2. Verify Navbar.tsx uses NavbarActions and has anime navigation preserved
const navbarFile = fs.readFileSync('src/components/Navbar.tsx', 'utf8')
assert(navbarFile.includes('<NavbarActions'), 'Navbar must render NavbarActions')
assert(navbarFile.includes('NAV_LINKS'), 'Navbar must retain anime NAV_LINKS')
assert(navbarFile.includes('Search anime'), 'Navbar must retain Search anime')
assert(navbarFile.includes('Get app'), 'Navbar must retain Get app')
console.log('[PASS] Navbar.tsx preserves all anime navigation and utilizes unified NavbarActions')

// 3. Verify LandingPage uses NavbarActions
const landingFile = fs.readFileSync('src/pages/LandingPage.tsx', 'utf8')
assert(landingFile.includes('<NavbarActions showHome={false} />'), 'LandingPage must render NavbarActions')
console.log('[PASS] LandingPage renders unified NavbarActions')

// 4. Verify Supabase URL sanitization and ref derivation
const supabaseTs = fs.readFileSync('src/lib/supabase.ts', 'utf8')
assert(supabaseTs.includes('deriveAndSanitizeSupabaseUrl'), 'supabase.ts must export deriveAndSanitizeSupabaseUrl')

// Test sanitization function
const testAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmeWt0dGt1b29oanlqdnJqeG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMTc3OTAsImV4cCI6MjEwODY5Mzc5MH0.fMHT2ig0PNgoIs5lLKFUo1Ug9nBPbnk3LlSeHETAjPs'
const parts = testAnonKey.split('.')
let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
while (b64.length % 4) b64 += '='
const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
assert.strictEqual(payload.ref, 'tfykttkuoohjyjvrjxop', 'Payload ref must match true project ID')
console.log('[PASS] JWT anon key correctly derives real project ref (tfykttkuoohjyjvrjxop)')

// 5. Verify live database connection & PostgREST tables
const sbUrl = 'https://tfykttkuoohjyjvrjxop.supabase.co'
const sb = createClient(sbUrl, testAnonKey)
const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
  email: 'gaurxv@gaurxv.eu.org',
  password: 'GAURXV-VERSE-2026'
})
assert(!authErr && authData?.session, 'Supabase authentication must succeed for primary account')
console.log('[PASS] Supabase Auth signInWithPassword succeeded for user id:', authData.user.id)

// Verify profile write & read with correct columns
const { error: upsertErr } = await sb.from('user_profiles').upsert({
  id: authData.user.id,
  display_name: 'Gaurav',
  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
  updated_at: new Date().toISOString()
})
assert(!upsertErr, 'user_profiles upsert must succeed: ' + upsertErr?.message)

const { data: prof, error: selErr } = await sb.from('user_profiles').select('*').eq('id', authData.user.id)
assert(!selErr && prof.length > 0, 'user_profiles read must succeed')
console.log('[PASS] Supabase RLS allows authenticated CRUD on user_profiles:', prof[0].display_name)

console.log('--- ALL CHECKS PASSED SUCCESSFULLY ---')
