// Centralized TMDB Client for Stark Entertainment / Gaurxv Verse
// Performs server-side TMDB fetching using Cloudflare environment variables:
// - TMDB_API_KEY
// - TMDB_BEARER_TOKEN (or TMDB_API_READ_ACCESS_TOKEN)
// Supports multi-key rotation and resilient proxy fallbacks.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
export const TMDB_API_BASE = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
export const TMDB_FALLBACK = "https://webpage-launchpad.lovable.app/api/public/proxy";

export const TMDB_KEYS = [
  "c7db6169bfdd3fc9f7dd6c44ea8ad100",
  "4e44d9029b1270a757cddc766a1bcb63",
  "844dba0bfd8f3a4f3799f6130ef9e335",
  "3fd2be6f0c70a2a598f084ddfb75487c",
];

export const DEFAULT_TMDB_API_KEY = TMDB_KEYS[0];

export const DEFAULT_TMDB_BEARER_TOKEN =
  "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjN2RiNjE2OWJmZGQzZmM5ZjdkZDZjNDRlYThhZDEwMCIsIm5iZiI6MTc1NDM3NjY0MC40MDYwMDAxLCJzdWIiOiI2YWY0MDNjOWI4YTRlMzU1YjYzNGVkOTciLCJzY29wZXMiOlsicXBsX3JlYWQiXSwidmVyc2lvbiI6MX0.ww3C_pAWxT63xXVM9OAkq8aSEyFhmyA5VaobbE-E0y4";

/**
 * Fetch from TMDB server-side with multi-tier failover and key rotation.
 * @param {string} endpoint - e.g. "trending/movie/week" or "movie/popular?language=en-US"
 * @param {object} [env] - Cloudflare Worker/Pages environment
 */
export async function tmdbFetch(endpoint, env = null) {
  const customKey =
    env?.TMDB_API_KEY ||
    env?.TMDB_KEY ||
    (typeof process !== "undefined" && (process.env?.TMDB_API_KEY || process.env?.TMDB_KEY));

  const token =
    env?.TMDB_BEARER_TOKEN ||
    env?.TMDB_API_READ_ACCESS_TOKEN ||
    env?.TMDB_READ_ACCESS_TOKEN ||
    (typeof process !== "undefined" && (process.env?.TMDB_BEARER_TOKEN || process.env?.TMDB_API_READ_ACCESS_TOKEN)) ||
    DEFAULT_TMDB_BEARER_TOKEN;

  const keyPool = customKey ? [customKey, ...TMDB_KEYS] : TMDB_KEYS;

  // Normalize endpoint: strip leading slash or full TMDB URL
  let clean = endpoint.startsWith("http")
    ? endpoint.replace(/^https?:\/\/[^\/]+(?:\/3|\/api\/tmdb)?\/?/, "")
    : endpoint.replace(/^\/+/, "");

  for (const apiKey of keyPool) {
    const sep = clean.includes("?") ? "&" : "?";
    const hasKey = clean.includes("api_key=");
    const directUrl = `${TMDB_API_BASE}/${clean}${hasKey ? "" : `${sep}api_key=${apiKey}`}`;

    // Tier 1: Direct official TMDB API from Cloudflare edge
    try {
      const res = await fetch(directUrl, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": UA,
        },
        signal: AbortSignal.timeout(4500),
      });
      if (res.ok) {
        return await res.json();
      }
      // If 401 or 429, try next key in pool
      if (res.status === 401 || res.status === 429) {
        continue;
      }
    } catch (_e) {
      // Network/connect error on direct TMDB (e.g. ISP or local block), proceed to proxy
    }

    // Tier 2: Resilient proxy fallback via Lovable Edge Proxy
    try {
      const fallbackUrl = `${TMDB_FALLBACK}?url=${encodeURIComponent(directUrl)}`;
      const res = await fetch(fallbackUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": UA,
        },
        signal: AbortSignal.timeout(5500),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && !data.error) return data;
      }
    } catch (_e) {
      // Proxy error, try next key
    }
  }

  throw new Error(`TMDB fetch failed for ${endpoint}`);
}
