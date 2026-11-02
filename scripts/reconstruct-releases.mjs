import { execSync } from 'node:child_process';

// 1. Retrieve authenticated GitHub token from Git Credential Manager
const creds = execSync('git credential fill', {
  input: 'protocol=https\nhost=github.com\n\n',
  encoding: 'utf8',
});
const token = creds
  .split('\n')
  .find((l) => l.startsWith('password='))
  ?.slice(9)
  .trim();

if (!token) {
  console.error('Failed to obtain GitHub token from git credential manager.');
  process.exit(1);
}

// 2. Define historical release specifications based on actual Git commits
const releases = [
  {
    tag: 'v1.0.1',
    commit: '12904503ae198988a9369cd22de5f284a941396b',
    name: 'Stark Entertainment v1.0.1',
    body: `## Stark Entertainment v1.0.1

### Minor Bug Fixes & Improvements
- Converted Japanese titles and watermarks across the application interface to English.
- Installed custom Stark Arc Reactor logo and favicon (\`favicon.svg\`, \`logo.svg\`).
- Corrected SVG XML namespaces and viewBox dimensions for high-DPI displays.
- Restored \`SELF_HOST_PATH\` export and neutralized \`FreePlanNotice\` modal.`,
  },
  {
    tag: 'v1.1.0',
    commit: 'cf37f19d9ded50145b1ed359ecd65a1bf2a49bcd',
    name: 'Stark Entertainment v1.1.0 — Universe Hub & Routing',
    body: `## Stark Entertainment v1.1.0

### New Features
- **Universe Hub Navigation:** Routed Home and Logo to Universe Hub (\`/\`) as the centralized media gateway.
- **Anime Section Isolation:** Migrated anime streaming catalog to dedicated \`/anime\` route with backward-compatible redirects from legacy \`/home\`.
- **Cloudflare Access Identity:** Integrated Cloudflare Access identity headers for edge authentication.

### Minor Bug Fixes & Improvements
- Inverted logo contrast for optimal visibility against dark theme backgrounds.
- Fixed TypeScript compiler errors (\`TS6133\`, \`TS2304\`) in \`ProfileHero\`.`,
  },
  {
    tag: 'v1.2.0',
    commit: '30e0ca8dfef16b0734ea282a610bb8b8e32aace7',
    name: 'Stark Entertainment v1.2.0 — Stark Security Gate & Cloudflare KV',
    body: `## Stark Entertainment v1.2.0

### New Features
- **Stark Security Gate:** Built-in security clearance screen with animated Lottie keyhole graphics and credit-card free access verification.
- **Admin Console (\`/admin\`):** Dedicated administrative control center for user credential provisioning, revocation, and session auditing.
- **Cloudflare KV Integration:** Made Cloudflare \`STARK_KV\` authoritative master store with instant device sync via URL hash payloads.

### Minor Bug Fixes & Improvements
- Removed credentials and real names from login input placeholders.
- Displayed real authenticated username instead of fallback guest string.
- Enabled bulk user credential deletion and revocation in Admin Console.`,
  },
  {
    tag: 'v1.3.0',
    commit: 'dc835f595f47e6feda36ed36977962015fa2dd5a',
    name: 'Stark Entertainment v1.3.0 — Ebooks Vault & Embedded Reader',
    body: `## Stark Entertainment v1.3.0

### New Features
- **4th Media Pillar — Ebooks Vault:** Integrated Project Gutenberg and Open Library public domain literature catalogs.
- **Embedded Literature Reader:** Built-in distraction-free reader with font-size adjustments, dark/sepia themes, and chapter jump navigation.
- **Continue Reading Shelf:** Added reading progress tracking with persistent resume state and quick preview modal.

### Minor Bug Fixes & Improvements
- Eliminated duplicate home navigation elements across subpages.
- Added background particle animations to landing page with resilient fallback covers.
- Resolved novel blank reader error state during chapter pagination.`,
  },
  {
    tag: 'v2.0.0',
    commit: '2e48762a3b294d11bc5e7ebe043468dd89cb4a0e',
    name: 'Stark Entertainment v2.0.0 — Supabase Cloud Architecture, ePUB/PDF & PWA',
    body: `## Stark Entertainment v2.0.0

### Major Changes
- **Supabase Cloud Architecture:** Migrated identity and synchronization from local storage to Supabase GoTrue Auth with PostgreSQL Row-Level Security (RLS).
- **Multi-Format Reading Engine:** Embedded native ePUB (\`epubjs\`) and PDF (\`pdfjs-dist\`) rendering engines directly into the browser.
- **Progressive Web App (PWA):** Transformed platform into an installable PWA with offline precaching via \`vite-plugin-pwa\` and Service Worker.

### New Features
- External media integrations for Trakt scrobbling, Jellyfin servers, and Komga comic libraries.
- Bidirectional cloud synchronization for user profiles, reading progress, and watchlists.

### Security
- Comprehensive RLS policies on \`user_profiles\`, \`user_library\`, \`user_reading_progress\`, and \`user_preferences\`.
- Client-side HMAC SHA-256 session tokens with automatic expiration.`,
  },
  {
    tag: 'v2.1.0',
    commit: 'a134f5b19eefe9dded0434605efaebd6f836a497',
    name: 'Stark Entertainment v2.1.0 — Lossless Music Engine & Regional Read Aloud',
    body: `## Stark Entertainment v2.1.0

### New Features
- **6th Media Pillar — Gaurxv Verse Music:** Streaming music engine powered by JioSaavn direct serverless resolver and Piped API.
- **Global Persistent Audio Player:** Desktop bottom bar and mobile queue drawer with synchronized playback and video anti-conflict guard.
- **Regional Read Aloud (TTS):** Text-to-speech engine for ebooks supporting six Indian languages and Devanagari verse chunking.

### Minor Bug Fixes & Improvements
- Implemented pure JS DES stream decryption for direct high-bitrate audio streaming without third-party proxies.
- Added SSRF guardrails and Piped timeout fallbacks.
- Enabled immediate PWA client claiming on service worker updates.`,
  },
  {
    tag: 'v2.1.1',
    commit: '83d05a575a0cfb5e0e1b5f7162ca3e4e55a9b022',
    name: 'Stark Entertainment v2.1.1 — Navigation & Auth Polish',
    body: `## Stark Entertainment v2.1.1

### Minor Bug Fixes & Improvements
- Unified navigation items with rounded pill button styling across all six media pillars.
- Resolved Supabase cloud sync race condition and unified navbar action layouts.
- Auto-synced Supabase admin credentials and removed legacy anime navigation from Profile view.
- Removed obsolete "Local Only" and "Connect Cloud" buttons in favor of automatic sync.`,
  },
  {
    tag: 'v2.2.0',
    commit: 'a7cab8665cbb56fcf2f40fcd6949a5b295ea11ef',
    name: 'Stark Entertainment v2.2.0 — Subscription Portal & Telegram Bot Approval',
    body: `## Stark Entertainment v2.2.0

### New Features
- **Subscription & Payment Portal (\`payments.gaurxv.eu.org\`):** Self-service portal for ₹29 / 30-day all-access passes with dynamic UPI QR and screenshot upload.
- **Telegram Bot (@JarvisXPay_Bot):** Real-time payment alerts with 1-tap in-chat payment verification and pass activation.
- **Brevo Transactional Delivery:** Automated confirmation emails dispatched upon payment verification.
- **Branded OpenGraph Identity:** Official 1200x630 OG preview card and social metadata.

### Minor Bug Fixes & Improvements
- Auto-healing Supabase cloud sync session across mobile and secondary devices.
- Responsive Montserrat typography and layout expansion for payment portal.
- Pending payment queue multi-device visibility.`,
  },
  {
    tag: 'v2.3.0',
    commit: '1bba771d68b770aaadbde60fbe7629f5aa5bdb30',
    name: 'Stark Entertainment v2.3.0 — Account Deletion, Cloud Settings & App Tour',
    body: `## Stark Entertainment v2.3.0

### New Features
- **Permanent Account Deletion:** Built-in account deletion action in User Access Policies (\`/admin\`) with cascading foreign-key cleanup and immutable audit logging.
- **Cloud Settings Sync:** Real-time synchronization of user settings (\`public.user_settings\`) with live "Synced" status indicator on profile page.
- **Interactive Application Tour Modal:** 6-slide visual walkthrough showcasing actual screenshots of Anime, Movies, Manga, Novels, Music, and Security Vault.
- **Standardized Trial Duration:** Standardized free trial duration to 20 minutes across gate, modals, and backend.

### Security
- Protected primary administrator (\`@gaurxv\`) from accidental deletion.
- Required typing the exact username to confirm permanent account deletion.`,
  },
  {
    tag: 'v2.3.1',
    commit: '4a37b2c379a42f0146fa0d07b37f61994b4570d4',
    name: 'Stark Entertainment v2.3.1 — Personal Email Identity Protection',
    body: `## Stark Entertainment v2.3.1

### Minor Bug Fixes & Improvements
- Completely eliminated artificial domain emails (\`@gaurxv.eu.org\`, \`@pepperonyx.dpdns.org\`) for normal users.
- Enforced canonical personal email preservation across login, profile, user access, and Supabase Auth.
- Cleaned up duplicate and synthetic records from the database.`,
  },
  {
    tag: 'v2.4.0',
    commit: '4cf56cd641a3fbc8c3d5b5a5cd51826e44c5268f',
    name: 'Stark Entertainment v2.4.0 — Automated Account Requests & Brevo Email Invitations',
    body: `## Stark Entertainment v2.4.0

### New Features
- **Automated Account Request System:** Replaced manual credential issuance with automated account requests from Stark Login Gate.
- **Interactive Telegram Bot Approval:** One-tap policy selection in Telegram Bot: 20-min Trial, Lifetime Free, ₹29 Subscription, or Custom Duration.
- **Brevo Email Invitation Delivery:** Dispatches official Stark-branded invitation emails with single-use \`[ CREATE MY PASSWORD ]\` links from \`updates@gaurxv.eu.org\` (reply-to: \`work@gaurxv.eu.org\`).
- **Dedicated Password Setup Page (\`/auth/setup-password?token=...\`):** Invited users create their own passwords and immediately unlock Gaurxv Verse without admin handling plaintext passwords.
- **Section 12 Confirmation Popup:** Prominent confirmation modal with unique Request Reference, 6-hour guarantee warning, and spam folder guidance.

### Minor Bug Fixes & Improvements
- Centered \`Subscription & Payment Portal (payments.gaurxv.eu.org)\` text and icon on Stark Login Gate.
- Disabled web page previews on Telegram notification links to prevent legacy Zenkai card previews.
- Upgraded Supabase \`account_requests\` RLS policies to allow \`UPDATE\` and \`DELETE\`.
- Expanded \`account_requests_status_check\` constraint and added idempotent rejection/approval guards to prevent duplicate emails.`,
  },
];

async function publish() {
  console.log(`Starting publication of ${releases.length} historical releases...`);

  for (const rel of releases) {
    console.log(`\n--- Processing ${rel.tag} (${rel.name}) ---`);

    // 1. Create Git tag locally pointing to exact commit if not exists
    try {
      execSync(`git tag -a ${rel.tag} ${rel.commit} -m "${rel.name}"`, { stdio: 'pipe' });
      console.log(`  [Git] Created tag ${rel.tag} pointing to commit ${rel.commit.slice(0, 7)}`);
    } catch {
      console.log(`  [Git] Tag ${rel.tag} already exists locally.`);
    }

    // 2. Push tag to GitHub origin
    try {
      execSync(`git push origin ${rel.tag}`, { stdio: 'pipe' });
      console.log(`  [Git] Pushed tag ${rel.tag} to origin`);
    } catch {
      console.log(`  [Git] Tag ${rel.tag} already present on remote.`);
    }

    // 3. Create or update GitHub Release via REST API
    try {
      const res = await fetch('https://api.github.com/repos/Gaurxv-builds/Stark-Entertainment/releases', {
        method: 'POST',
        headers: {
          Authorization: `token ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Stark-Release-Manager',
        },
        body: JSON.stringify({
          tag_name: rel.tag,
          name: rel.name,
          body: rel.body,
          draft: false,
          prerelease: false,
        }),
      });

      const data = await res.json();
      if (res.status === 201) {
        console.log(`  [GitHub Release] Published: ${data.html_url}`);
      } else if (res.status === 422 && data.errors?.[0]?.code === 'already_exists') {
        console.log(`  [GitHub Release] Already published for ${rel.tag}`);
      } else {
        console.warn(`  [GitHub Release] Notice (${res.status}):`, data.message || data);
      }
    } catch (err) {
      console.error(`  [GitHub Release] Error:`, err.message);
    }
  }

  console.log('\nAll historical releases processed successfully!');
}

publish().catch(console.error);
