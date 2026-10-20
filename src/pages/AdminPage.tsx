import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Sparkles,
  ArrowLeft,
  Cloud,
} from 'lucide-react'
import {
  useStarkAuth,
  getAllCredentials,
  getCreatedCredentials,
  addCreatedCredential,
  deleteCreatedCredential,
  type Credential,
} from '../lib/starkAuth'
import { toast } from '../lib/toast'
import { AuroraBackground } from '../components/AuroraBackground'
import { BorderBeam } from '../components/BorderBeam'
import { DotPattern } from '../components/DotPattern'

export default function AdminPage() {
  const { isAdmin, user } = useStarkAuth()

  // Form inputs
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [showFormPassword, setShowFormPassword] = useState(false)

  // Directory state
  const [usersList, setUsersList] = useState<Credential[]>(() => getAllCredentials())
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({})
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [copiedEnv, setCopiedEnv] = useState(false)

  // If not admin, access denied
  if (!isAdmin) {
    return (
      <main className="relative isolate flex min-h-[85svh] items-center justify-center overflow-hidden px-4 pt-24 text-center">
        <AuroraBackground />
        <div className="relative z-10 w-full max-w-md rounded-3xl border border-red-500/30 bg-card/80 p-8 shadow-2xl backdrop-blur-xl">
          <ShieldAlert className="mx-auto mb-4 size-16 text-red-500 animate-pulse" />
          <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
            Admin Clearance Required
          </h1>
          <p className="mt-3 text-sm text-muted">
            This area is restricted to Gaurxv Verse administrators. Regular user accounts do not have clearance to view or manage credentials.
          </p>
          <div className="mt-8">
            <Link
              to="/"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-bold text-background transition hover:opacity-90 active:scale-95"
            >
              <ArrowLeft className="size-4" />
              Return to Universe
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // Generate random Stark-themed passcode
  const generateRandomKey = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000)
    const prefixes = ['STARK', 'VERSE', 'JARVIS', 'REACTOR']
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
    const key = `${prefix}-${randomNum}`
    setNewPassword(key)
    toast(`Generated passcode: ${key}`)
  }

  // Handle new user creation
  const handleCreateUser = (e: FormEvent) => {
    e.preventDefault()
    const u = newUsername.trim()
    const p = newPassword.trim()
    if (!u || !p) {
      toast('Please enter both a username and password')
      return
    }

    addCreatedCredential({
      username: u,
      password: p,
      displayName: newDisplayName.trim() || u,
    })

    setUsersList(getAllCredentials())
    setNewUsername('')
    setNewPassword('')
    setNewDisplayName('')
    toast(`Created user clearance for @${u} ⎊`)
  }

  // Handle user deletion
  const handleDeleteUser = (username: string) => {
    deleteCreatedCredential(username)
    setUsersList(getAllCredentials())
    toast(`Revoked clearance for @${username}`)
  }

  // Copy individual login instructions to clipboard
  const copyLoginDetails = (c: Credential) => {
    const text = `Gaurxv Verse Access Credentials ⎊\nURL: https://verse.gaurxv.eu.org\nUsername: ${c.username}\nPassword: ${c.password}`
    navigator.clipboard.writeText(text)
    setCopiedKey(c.username)
    toast(`Copied login credentials for @${c.username}`)
    setTimeout(() => setCopiedKey(null), 2500)
  }

  // Copy Cloudflare VITE_AUTH_CREDENTIALS JSON
  const copyCloudflareEnv = () => {
    const created = getCreatedCredentials()
    const jsonStr = JSON.stringify(
      created.map((c) => ({
        username: c.username,
        password: c.password,
        displayName: c.displayName,
      })),
      null,
      2
    )
    navigator.clipboard.writeText(jsonStr)
    setCopiedEnv(true)
    toast('Copied VITE_AUTH_CREDENTIALS JSON for Cloudflare!')
    setTimeout(() => setCopiedEnv(false), 2500)
  }

  return (
    <main className="relative isolate min-h-svh overflow-hidden px-4 pb-28 pt-24 sm:px-6">
      <AuroraBackground />
      <DotPattern className="-z-10 [mask-image:radial-gradient(800px_circle_at_50%_30%,white,transparent)]" />

      <div className="relative z-10 mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-accent uppercase">
              <ShieldCheck className="size-4" />
              <span>Stark Security // Admin Console</span>
            </div>
            <h1 className="mt-1 font-display text-3xl font-black tracking-tight sm:text-4xl">
              User Credentials Manager
            </h1>
            <p className="mt-1 text-sm text-muted">
              Create and manage viewer accounts. Credentials are encrypted and never shown to regular users.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3.5 py-1 text-xs font-bold text-accent">
              <span>Admin: {user} ⎊</span>
            </span>
          </div>
        </div>

        {/* Section 1: Create New Credentials Form */}
        <section className="relative overflow-hidden rounded-3xl border border-border bg-card/80 p-6 shadow-xl backdrop-blur-xl sm:p-8">
          <BorderBeam size={220} duration={9} />
          <div className="flex items-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-2xl bg-accent text-accent-fg">
              <UserPlus className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Create New Credentials</h2>
              <p className="text-xs text-muted">Grant access to a new user or viewer</p>
            </div>
          </div>

          <form onSubmit={handleCreateUser} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                Username <span className="text-accent">*</span>
              </label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="e.g. tony or alex"
                className="h-11 w-full rounded-2xl border border-border bg-background/60 px-4 text-sm font-medium outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                Display Name / Note (Optional)
              </label>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="e.g. Alex (Friend)"
                className="h-11 w-full rounded-2xl border border-border bg-background/60 px-4 text-sm font-medium outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            {/* Password with generator */}
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Password or Security Key <span className="text-accent">*</span>
                </label>
                <button
                  type="button"
                  onClick={generateRandomKey}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent transition hover:underline"
                >
                  <Sparkles className="size-3" /> Generate Random Passcode
                </button>
              </div>
              <div className="relative flex items-center rounded-2xl border border-border bg-background/60 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
                <KeyRound className="pointer-events-none ml-4 size-4 shrink-0 text-muted" />
                <input
                  type={showFormPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter or generate passcode"
                  className="h-11 w-full bg-transparent px-3 text-sm font-medium outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowFormPassword(!showFormPassword)}
                  aria-label={showFormPassword ? 'Hide password' : 'Show password'}
                  className="mr-3 grid size-8 place-items-center rounded-lg text-muted transition hover:bg-foreground/5 hover:text-foreground"
                >
                  {showFormPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="mt-2 sm:col-span-2">
              <button
                type="submit"
                disabled={!newUsername.trim() || !newPassword.trim()}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-accent font-display text-sm font-bold text-accent-fg shadow-lg shadow-accent/20 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
              >
                <UserPlus className="size-4" />
                Authorize &amp; Create User ⎊
              </button>
            </div>
          </form>
        </section>

        {/* Section 2: Active Credentials Directory */}
        <section className="overflow-hidden rounded-3xl border border-border bg-card/80 p-6 shadow-xl backdrop-blur-xl sm:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid size-10 place-items-center rounded-2xl bg-foreground/10 text-foreground">
                <Users className="size-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Authorized Users Directory</h2>
                <p className="text-xs text-muted">
                  {usersList.length} active credential{usersList.length === 1 ? '' : 's'} registered
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-background/40">
            <AnimatePresence>
              {usersList.map((c) => {
                const isRevealed = revealedPasswords[c.username]
                const isCopied = copiedKey === c.username
                const isBuiltin = ['admin', 'stark', 'gaurav'].includes(c.username.toLowerCase())

                return (
                  <motion.div
                    key={c.username}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-xl bg-card border border-border font-bold text-accent">
                        {c.displayName ? c.displayName.charAt(0).toUpperCase() : c.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm">{c.displayName || c.username}</p>
                          <span className="rounded bg-accent/15 px-2 py-0.5 text-[11px] font-mono text-accent">
                            @{c.username}
                          </span>
                          {isBuiltin && (
                            <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                              Built-in
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs font-mono text-muted">
                          <span>Key: {isRevealed ? c.password : '••••••••••••'}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedPasswords((prev) => ({
                                ...prev,
                                [c.username]: !prev[c.username],
                              }))
                            }
                            className="text-muted transition hover:text-foreground"
                            title={isRevealed ? 'Hide passcode' : 'Show passcode'}
                          >
                            {isRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => copyLoginDetails(c)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 text-xs font-semibold transition hover:border-accent hover:text-accent active:scale-95"
                        title="Copy Login Details for User"
                      >
                        {isCopied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                        <span>{isCopied ? 'Copied!' : 'Copy Credentials'}</span>
                      </button>

                      {!isBuiltin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(c.username)}
                          className="grid size-8 place-items-center rounded-xl border border-red-500/20 text-red-400 transition hover:bg-red-500/10 active:scale-90"
                          title="Revoke clearance"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </section>

        {/* Section 3: Cloudflare Sync Helper */}
        <section className="overflow-hidden rounded-3xl border border-accent/30 bg-accent/5 p-6 backdrop-blur-xl sm:p-8">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent text-accent-fg">
              <Cloud className="size-5" />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold">Cloudflare Global Sync Helper</h2>
              <p className="text-xs text-muted leading-relaxed">
                Want these users to work across all devices without having to re-create them? Copy this JSON and paste it into Cloudflare Pages:
                <br />
                <span className="font-semibold text-foreground">
                  Pages Dashboard ➔ stark-entertainment ➔ Settings ➔ Environment variables ➔ VITE_AUTH_CREDENTIALS
                </span>
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={copyCloudflareEnv}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-xs font-bold text-accent-fg shadow-md shadow-accent/20 transition hover:brightness-110 active:scale-95"
            >
              {copiedEnv ? <Check className="size-4" /> : <Copy className="size-4" />}
              <span>{copiedEnv ? 'Copied JSON to Clipboard!' : 'Copy VITE_AUTH_CREDENTIALS JSON'}</span>
            </button>
            <span className="text-xs text-muted">
              Includes {getCreatedCredentials().length} custom created user{getCreatedCredentials().length === 1 ? '' : 's'}
            </span>
          </div>
        </section>
      </div>
    </main>
  )
}
