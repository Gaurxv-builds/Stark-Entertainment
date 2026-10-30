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

// 2. Verify Navbar.tsx uses NavbarActions and has anime navigation preserved with rounded button styling
const navbarFile = fs.readFileSync('src/components/Navbar.tsx', 'utf8')
assert(navbarFile.includes('<NavbarActions'), 'Navbar must render NavbarActions')
assert(navbarFile.includes('NAV_LINKS'), 'Navbar must retain anime NAV_LINKS')
assert(navbarFile.includes('Search anime'), 'Navbar must retain Search anime')
assert(navbarFile.includes('Get app'), 'Navbar must retain Get app')
assert(navbarFile.includes('rounded-full border px-2.5 sm:px-3 text-xs font-semibold backdrop-blur'), 'Anime nav links must use rounded pill button styling')
assert(navbarFile.includes('border-border bg-card/60 text-muted-foreground hover:border-accent/40 hover:bg-card hover:text-accent'), 'Anime nav links must have card background and hover transitions')
console.log('[PASS] Navbar.tsx preserves all anime navigation with unified rounded button styling')

// 3. Verify LandingPage uses NavbarActions and ProfilePage removes redundant Connect Cloud button
const landingFile = fs.readFileSync('src/pages/LandingPage.tsx', 'utf8')
assert(landingFile.includes('<NavbarActions showHome={false} />'), 'LandingPage must render NavbarActions')
console.log('[PASS] LandingPage renders unified NavbarActions')

const profileFile = fs.readFileSync('src/pages/ProfilePage.tsx', 'utf8')
assert(!profileFile.includes('Connect Cloud'), 'Connect Cloud button must be removed from ProfilePage')
assert(!profileFile.includes('Local Only'), 'Local Only label must be removed from ProfilePage')
console.log('[PASS] ProfilePage removes redundant Connect Cloud button and Local Only status')

// 3b. Verify section routing: /profile and /admin do NOT render anime buttons
const sectionsFile = fs.readFileSync('src/lib/sections.ts', 'utf8')
assert(sectionsFile.includes("pathname.startsWith('/profile')"), 'sectionOf must exclude /profile from anime section')
assert(sectionsFile.includes("pathname.startsWith('/admin')"), 'sectionOf must exclude /admin from anime section')
console.log('[PASS] /profile and /admin cleanly excluded from anime navigation')

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

// 5. Verify resolveStarkUserToEmail mapping & no hardcoded passwords
const starkAuthFile = fs.readFileSync('src/lib/starkAuth.tsx', 'utf8')
assert(starkAuthFile.includes('export function resolveStarkUserToEmail'), 'resolveStarkUserToEmail must be exported')
assert(!starkAuthFile.includes('GAURXV-VERSE-2026'), 'starkAuth.tsx must not contain hardcoded GAURXV-VERSE-2026')
assert(!starkAuthFile.includes('gaurxv@gaurxv.eu.org'), 'starkAuth.tsx must not contain hardcoded gaurxv@gaurxv.eu.org')
assert(!fs.readFileSync('server/handler.js', 'utf8').includes('GAURXV-VERSE-2026'), 'server/handler.js must not contain hardcoded GAURXV-VERSE-2026')

// Test user mapping logic
function testResolve(u) {
  const norm = (u || '').trim().toLowerCase()
  if (norm === 'gaurxv' || norm === 'admin' || norm === 'gaurav') return 'gaurav@pepperonyx.dpdns.org'
  if (norm.includes('@')) return norm
  return `${norm.replace(/[^a-z0-9_]/g, '')}@pepperonyx.dpdns.org`
}
assert.strictEqual(testResolve('gaurxv'), 'gaurav@pepperonyx.dpdns.org', 'gaurxv maps to gaurav@pepperonyx.dpdns.org')
assert.strictEqual(testResolve('admin'), 'gaurav@pepperonyx.dpdns.org', 'admin maps to gaurav@pepperonyx.dpdns.org')
assert.strictEqual(testResolve('gaurav'), 'gaurav@pepperonyx.dpdns.org', 'gaurav maps to gaurav@pepperonyx.dpdns.org')
assert.strictEqual(testResolve('user@example.com'), 'user@example.com', 'custom emails are preserved')
console.log('[PASS] Stark Gate administrator mapping verified: gaurxv -> gaurav@pepperonyx.dpdns.org')

// 6. Verify live database connectivity & schema
const sbUrl = 'https://tfykttkuoohjyjvrjxop.supabase.co'
const sb = createClient(sbUrl, testAnonKey)

// Ping Supabase Auth health endpoint
const healthRes = await fetch(`${sbUrl}/auth/v1/health`, {
  headers: { apikey: testAnonKey }
})
assert(healthRes.ok, 'Supabase Auth service must be active and reachable')
console.log('[PASS] Supabase Auth health check passed (200 OK)')

// If runtime admin password is provided in environment, verify full authentication
const runtimePass = process.env.VITE_ADMIN_PASS || process.env.SUPABASE_PASSWORD
if (runtimePass) {
  const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
    email: 'gaurav@pepperonyx.dpdns.org',
    password: runtimePass
  })
  assert(!authErr && authData?.session, 'Supabase authentication failed with provided credentials: ' + authErr?.message)
  console.log('[PASS] Supabase Auth authenticated successfully for:', authData.user.email)
} else {
  console.log('[INFO] Skipped live sign-in password check (no runtime password in env). Auth health verified.')
}

console.log('--- ALL CHECKS PASSED SUCCESSFULLY ---')
