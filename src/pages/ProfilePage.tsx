import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Moon, Sun, ShieldCheck, ShieldAlert, Cloud, RefreshCw, LogOut } from 'lucide-react'
import { useStarkAuth } from '../lib/starkAuth'
import { loadIntegrations, saveIntegrations, testJellyfinConnection, testKomgaConnection, type IntegrationSettings } from '../services/integrations'
import { AniListCard } from '../components/AniListCard'
import { ProfileCustomizer, ProfileHero, type SectionKey } from '../components/ProfileCustomizer'
import { CustomSelect } from '../components/CustomSelect'
import { GITHUB_PROFILE_URL, PORTFOLIO_URL, TELEGRAM_URL } from '../lib/app'
import { getPrefs, savePrefs, type Audio } from '../lib/library'
import { useProfile } from '../lib/profile'
import { DIRECT } from '../lib/servers'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'
import { useTheme } from '../context/ThemeContext'
import { useFlag } from '../hooks/useFlag'
import { BRAND_NAME, pageTitle } from '../lib/brand'

const card = 'rounded-3xl border border-border bg-card/60 p-5 sm:p-6'
const h2 = 'font-display text-xl font-bold'

/** A string kept in localStorage (empty string = unset). */
function useStored(key: string): [string, (v: string) => void] {
  const [v, setV] = useState(() => {
    try {
      return localStorage.getItem(key) ?? ''
    } catch {
      return ''
    }
  })
  return [
    v,
    (n) => {
      setV(n)
      try {
        if (n) localStorage.setItem(key, n)
        else localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    },
  ]
}

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3.5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cn('relative h-7 w-12 rounded-full border transition', on ? 'border-transparent bg-accent' : 'border-border bg-card-2')}>
      <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', on ? 'left-6' : 'left-0.5')} />
    </button>
  )
}

const LANGS = ['ja', 'en', 'hi', 'es', 'pt', 'fr', 'de', 'it', 'ar', 'ru', 'ko', 'zh']
const langName = (c: string) => new Intl.DisplayNames(['en'], { type: 'language' }).of(c) ?? c

export default function ProfilePage() {
  const me = useProfile()
  const { logout, user: authUser, isAdmin, isCloudSynced, triggerSync, syncDiagnostics } = useStarkAuth()
  const [syncing, setSyncing] = useState(false)
  const { theme, setTheme } = useTheme()
  const [integrations, setIntegrations] = useState<IntegrationSettings>(loadIntegrations)
  const [testingService, setTestingService] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<SectionKey>>(() => new Set(['avatar']))

  const [prefs, setPrefs] = useState(getPrefs)
  const [autoNext, setAutoNext] = useFlag('zk:autonext', true)
  const [autoSkip, setAutoSkip] = useFlag('zk:autoskip', false)
  const [skipFiller, setSkipFiller] = useFlag('zk:skipfiller', false)
  const [layout, setLayout] = useStored('zk:eplayout')
  const [lang, setLang] = useStored('zp-alang')
  const [maxQ, setMaxQ] = useStored('zp-q')

  useEffect(() => {
    document.title = pageTitle('Profile')
    document.documentElement.dataset.zkMono = ''
    if (location.hash === '#legal') window.setTimeout(() => document.getElementById('legal')?.scrollIntoView({ behavior: 'smooth' }), 150)
    return () => {
      delete document.documentElement.dataset.zkMono
    }
  }, [])

  const edit = (k: SectionKey) => {
    setOpen((o) => new Set(o).add(k))
    window.setTimeout(() => document.getElementById(`pc-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  const setPref = (p: { server?: string; audio?: Audio }) => {
    savePrefs(p)
    setPrefs(getPrefs())
    if (p.audio) toast(`Default audio: ${p.audio === 'sub' ? 'Sub' : 'Dub'}`)
    if (p.server) toast(`Preferred server: ${DIRECT.find((d) => d.id === p.server)?.name ?? p.server}`)
  }
  const flag = (set: (v: boolean) => void, label: string) => (v: boolean) => {
    set(v)
    toast(`${label} ${v ? 'on' : 'off'}`)
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 pb-28 pt-24 sm:px-6">
      <ProfileHero me={me} onEdit={edit} />
      <ProfileCustomizer me={me} open={open} setOpen={setOpen} />
      <AniListCard me={me} />

      {/* Stark Security Gate & Cloud Sync */}
      <section className={card} aria-label="Security">
        <h2 className={cn(h2, 'mb-4')}>Stark Security Gate &amp; Cloud Sync</h2>
        <Row title="Protocol Status" hint={`Signed in as ${authUser || 'Operator'} · Stark Security Gate active`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              <ShieldCheck className="size-3.5" />
              <span>Unlocked ⎊</span>
            </span>
            {isAdmin && (
              <Link
                to="/admin"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3 text-xs font-bold text-accent transition hover:bg-accent hover:text-accent-fg active:scale-95"
              >
                <ShieldAlert className="size-3" /> Admin Console
              </Link>
            )}
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card-2 px-3 text-xs font-semibold text-muted transition hover:bg-card-3 hover:text-foreground active:scale-95"
            >
              <LogOut className="size-3" /> Sign Out
            </button>
          </div>
        </Row>
        <Row
          title="Cloud Synchronization"
          hint={
            syncDiagnostics?.message?.includes('password differs')
              ? 'Synced via Supabase PostgreSQL RLS (cross-device profile, watchlist & reading progress)'
              : syncDiagnostics?.message ||
                'Synced via Supabase PostgreSQL RLS (cross-device profile, watchlist & reading progress)'
          }
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
                isCloudSynced
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-accent/30 bg-accent/10 text-accent'
              )}
            >
              <Cloud className="size-3.5" />
              <span>{isCloudSynced ? 'Connected' : 'Synchronizing...'}</span>
            </span>
            <button
              type="button"
              disabled={syncing}
              onClick={async () => {
                setSyncing(true)
                const ok = await triggerSync()
                setSyncing(false)
                if (ok) toast('Synced library, reading progress & preferences to cloud', 'success')
                else toast('Cloud sync check completed', 'info')
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3 text-xs font-semibold text-accent transition hover:bg-accent hover:text-accent-fg active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={cn('size-3', syncing && 'animate-spin')} />
              <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>
        </Row>
      </section>

      {/* Preferences */}
      <section className={card} aria-label="Preferences">
        <h2 className={cn(h2, 'mb-4')}>Preferences</h2>
        <Row title="Theme">
          <div className="inline-flex gap-1 rounded-full border border-border bg-card/60 p-1">
            {(['dark', 'light'] as const).map((t) => (
              <button key={t} type="button" onClick={() => (setTheme(t), t !== theme && toast(`${t === 'dark' ? 'Dark' : 'Light'} theme on`))} aria-pressed={theme === t} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold capitalize transition', theme === t ? 'bg-foreground text-background' : 'text-muted')}>
                {t === 'dark' ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
                {t}
              </button>
            ))}
          </div>
        </Row>
        <Row title="Default audio" hint="Sub or dub, for servers that offer both">
          <div className="inline-flex gap-1 rounded-full border border-border bg-card/60 p-1">
            {(['sub', 'dub'] as const).map((a) => (
              <button key={a} type="button" onClick={() => setPref({ audio: a })} aria-pressed={(prefs.audio ?? 'sub') === a} className={cn('h-8 rounded-full px-3.5 text-sm font-semibold uppercase transition', (prefs.audio ?? 'sub') === a ? 'bg-foreground text-background' : 'text-muted')}>
                {a}
              </button>
            ))}
          </div>
        </Row>
        <Row title="Preferred audio language" hint="For multi-audio streams">
          <CustomSelect label="Preferred audio language" value={lang} onChange={(v) => (setLang(v), toast(v ? `Audio language: ${langName(v)}` : 'Audio language: Auto'))} placeholder="Auto" options={[{ value: '', label: 'Auto' }, ...LANGS.map((c) => ({ value: c, label: langName(c) }))]} />
        </Row>
        <Row title="Max quality" hint="Auto-switching never goes above this">
          <CustomSelect label="Max quality" value={maxQ} onChange={(v) => (setMaxQ(v), toast(v ? `Max quality: ${v}p` : 'Max quality: Auto'))} placeholder="Auto" options={[{ value: '', label: 'Auto (best)' }, { value: '1080', label: '1080p' }, { value: '720', label: '720p' }, { value: '480', label: '480p' }, { value: '360', label: '360p' }]} />
        </Row>
        <Row title="Preferred server" hint="Used when you open an episode">
          <CustomSelect label="Preferred server" value={prefs.server ?? 'megaplay'} onChange={(v) => setPref({ server: v })} placeholder="MegaPlay" options={DIRECT.map((s) => ({ value: s.id, label: s.name }))} />
        </Row>
        <Row title="Autoplay next episode">
          <Switch on={autoNext} onChange={flag(setAutoNext, 'Autoplay next')} label="Autoplay next episode" />
        </Row>
        <Row title="Auto-skip intro & outro">
          <Switch on={autoSkip} onChange={flag(setAutoSkip, 'Auto-skip intro & outro')} label="Auto-skip intro and outro" />
        </Row>
        <Row title="Skip filler episodes" hint="Next and autoplay jump over filler and recaps">
          <Switch on={skipFiller} onChange={flag(setSkipFiller, 'Skip filler')} label="Skip filler episodes" />
        </Row>
        <Row title="Episode cards" hint="Large cards instead of a compact list">
          <Switch on={layout === 'card'} onChange={(v) => (setLayout(v ? 'card' : 'list'), toast(`Episode cards ${v ? 'on' : 'off'}`))} label="Episode cards" />
        </Row>
      </section>

      
      {/* Optional External Media Integrations */}
      <section className={card} aria-label="Media Integrations">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className={h2}>Media Integrations (Optional)</h2>
            <p className="mt-0.5 text-xs text-muted">
              Connect external tracking services or self-hosted media servers. Disabled by default.
            </p>
          </div>
        </div>

        {/* Trakt */}
        <Row
          title="Trakt.tv"
          hint="Sync movie and episode watching progress automatically with your Trakt account"
        >
          <Switch
            on={integrations.trakt.enabled}
            onChange={(enabled) => {
              const next = { ...integrations, trakt: { ...integrations.trakt, enabled } };
              setIntegrations(next);
              saveIntegrations(next);
              toast(`Trakt integration ${enabled ? 'enabled' : 'disabled'}`);
            }}
            label="Trakt.tv integration"
          />
        </Row>
        {integrations.trakt.enabled && (
          <div className="rounded-2xl border border-border/60 bg-background/40 p-4 space-y-3 mb-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted uppercase">Trakt Client ID</label>
              <input
                type="text"
                value={integrations.trakt.clientId}
                onChange={(e) => {
                  const next = { ...integrations, trakt: { ...integrations.trakt, clientId: e.target.value } };
                  setIntegrations(next);
                  saveIntegrations(next);
                }}
                placeholder="Enter your Trakt API Client ID"
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-xs outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Automatic scrobbling</span>
              <Switch
                on={integrations.trakt.scrobbleWatching}
                onChange={(scrobbleWatching) => {
                  const next = { ...integrations, trakt: { ...integrations.trakt, scrobbleWatching } };
                  setIntegrations(next);
                  saveIntegrations(next);
                }}
                label="Trakt scrobble"
              />
            </div>
          </div>
        )}

        {/* Jellyfin */}
        <Row
          title="Jellyfin Server"
          hint="Connect to your personal self-hosted Jellyfin media server"
        >
          <Switch
            on={integrations.jellyfin.enabled}
            onChange={(enabled) => {
              const next = { ...integrations, jellyfin: { ...integrations.jellyfin, enabled } };
              setIntegrations(next);
              saveIntegrations(next);
              toast(`Jellyfin integration ${enabled ? 'enabled' : 'disabled'}`);
            }}
            label="Jellyfin server integration"
          />
        </Row>
        {integrations.jellyfin.enabled && (
          <div className="rounded-2xl border border-border/60 bg-background/40 p-4 space-y-3 mb-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted uppercase">Server URL</label>
              <input
                type="url"
                value={integrations.jellyfin.serverUrl}
                onChange={(e) => {
                  const next = { ...integrations, jellyfin: { ...integrations.jellyfin, serverUrl: e.target.value } };
                  setIntegrations(next);
                  saveIntegrations(next);
                }}
                placeholder="https://jellyfin.yourdomain.com"
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-xs outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                disabled={testingService === 'jellyfin' || !integrations.jellyfin.serverUrl}
                onClick={async () => {
                  setTestingService('jellyfin');
                  const res = await testJellyfinConnection(integrations.jellyfin);
                  setTestingService(null);
                  if (res.ok) {
                    toast(`Connected to ${res.info?.serverName || 'Jellyfin'} (v${res.info?.version || ''})`, 'success');
                  } else {
                    toast(res.error || 'Connection failed', 'error');
                  }
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/15 px-3 text-xs font-semibold text-accent transition hover:bg-accent hover:text-accent-fg active:scale-95 disabled:opacity-40"
              >
                {testingService === 'jellyfin' ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </div>
        )}

        {/* Komga */}
        <Row
          title="Komga Comic Server"
          hint="Connect to your personal Komga comic and manga server"
        >
          <Switch
            on={integrations.komga.enabled}
            onChange={(enabled) => {
              const next = { ...integrations, komga: { ...integrations.komga, enabled } };
              setIntegrations(next);
              saveIntegrations(next);
              toast(`Komga integration ${enabled ? 'enabled' : 'disabled'}`);
            }}
            label="Komga comic server integration"
          />
        </Row>
        {integrations.komga.enabled && (
          <div className="rounded-2xl border border-border/60 bg-background/40 p-4 space-y-3 mb-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted uppercase">Server URL</label>
              <input
                type="url"
                value={integrations.komga.serverUrl}
                onChange={(e) => {
                  const next = { ...integrations, komga: { ...integrations.komga, serverUrl: e.target.value } };
                  setIntegrations(next);
                  saveIntegrations(next);
                }}
                placeholder="https://komga.yourdomain.com"
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-xs outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                disabled={testingService === 'komga' || !integrations.komga.serverUrl}
                onClick={async () => {
                  setTestingService('komga');
                  const res = await testKomgaConnection(integrations.komga);
                  setTestingService(null);
                  if (res.ok) {
                    toast(`Connected to Komga (${res.libraries?.length || 0} libraries detected)`, 'success');
                  } else {
                    toast(res.error || 'Connection failed', 'error');
                  }
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/15 px-3 text-xs font-semibold text-accent transition hover:bg-accent hover:text-accent-fg active:scale-95 disabled:opacity-40"
              >
                {testingService === 'komga' ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* About & legal */}
      <section id="legal" className={cn(card, 'scroll-mt-24 space-y-5 text-sm leading-relaxed text-muted')} aria-label="About and legal">
        <h2 className={h2}>About &amp; legal</h2>
        <div>
          <h3 className="mb-1 font-semibold text-foreground">Disclaimer</h3>
          <p>
            {BRAND_NAME} does not host, upload or store any video, novel text or manga images. Streams, chapters and pages are provided by third-party services and are fetched at the moment you watch or read. {BRAND_NAME} has no control over that
            content and is not affiliated with those services. All titles, artwork and trademarks belong to their respective owners.
          </p>
        </div>
        <div>
          <h3 className="mb-1 font-semibold text-foreground">DMCA / copyright</h3>
          <p>
            If you own a work and believe something linked from {BRAND_NAME} infringes your copyright, the file lives on the third-party host, so please contact that host first. To tell us as well, reach the maintainers through{' '}
            <a href={GITHUB_PROFILE_URL} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2">GitHub</a>,{' '}
            <a href={PORTFOLIO_URL} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2">Portfolio</a> or{' '}
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2">Telegram</a>, and include: the work concerned, the exact {BRAND_NAME} page or link, your contact details, a statement that you act in good faith, and a statement that your notice is accurate and you
            are the owner or their authorised agent. We will review it and remove the link where appropriate.
          </p>
        </div>
        <div>
          <h3 className="mb-1 font-semibold text-foreground">Data &amp; credits</h3>
          <p>
            Anime data from AniList and MyAnimeList (via Jikan); filler information from AnimeFillerList; artwork and episode details from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB. Avatar frames come from the
            SillyTavern-AvatarDecorations-CSS collection, and preset avatars and banners from the avatar-banner list; that artwork belongs to its respective owners.
          </p>
        </div>
        <p>
          {isCloudSynced
            ? 'Your profile, watchlist, and reading library are synchronized securely with your cloud account.'
            : 'Your profile and preferences are kept in this browser. Connect your account for cross-device cloud sync.'}{' '}
          <Link to="/" className="text-foreground underline underline-offset-2">Back to {BRAND_NAME}</Link>
        </p>
      </section>
    </main>
  )
}
