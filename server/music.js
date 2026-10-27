/**
 * Server-side music resolver for JioSaavn with direct 320kbps AAC streaming URL decryption.
 * Uses zero-dependency pure JavaScript DES-ECB to decrypt encrypted_media_url into official saavncdn audio streams.
 */

const IP = [
  58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4,
  62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
  57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3,
  61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7,
];
const FP = [
  40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31,
  38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
  36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27,
  34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25,
];
const E = [
  32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9,
  8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17,
  16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25,
  24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1,
];
const P = [
  16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10,
  2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25,
];
const PC1 = [
  57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18,
  10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36,
  63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22,
  14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4,
];
const PC2 = [
  14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10,
  23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2,
  41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48,
  44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32,
];
const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
const SBOX = [
  [
    [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7],
    [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8],
    [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0],
    [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
  ],
  [
    [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10],
    [3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5],
    [0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15],
    [13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
  ],
  [
    [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8],
    [13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1],
    [13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7],
    [1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
  ],
  [
    [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15],
    [13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9],
    [10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4],
    [3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
  ],
  [
    [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9],
    [14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6],
    [4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14],
    [11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
  ],
  [
    [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11],
    [10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8],
    [9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6],
    [4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
  ],
  [
    [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1],
    [13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6],
    [1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2],
    [6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
  ],
  [
    [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7],
    [1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2],
    [7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8],
    [2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11],
  ],
];

function bytesToBits(bytes) {
  const bits = [];
  for (let i = 0; i < bytes.length; i++) {
    for (let b = 7; b >= 0; b--) bits.push((bytes[i] >> b) & 1);
  }
  return bits;
}

function bitsToBytes(bits) {
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i + b];
    bytes.push(byte);
  }
  return bytes;
}

function permute(bits, table) {
  return table.map((pos) => bits[pos - 1]);
}

/**
 * Pure JavaScript DES-ECB decryption with PKCS#5/7 unpadding.
 * Compatible with Node.js, Cloudflare Workers, and Web environments.
 */
export function desDecrypt(encryptedBase64, keyStr = '38346591') {
  if (!encryptedBase64 || typeof encryptedBase64 !== 'string') return '';
  try {
    const keyBytes = typeof Buffer !== 'undefined'
      ? [...Buffer.from(keyStr, 'utf8')]
      : [...new TextEncoder().encode(keyStr)];

    const keyBits = bytesToBits(keyBytes);
    const pc1 = permute(keyBits, PC1);
    let c = pc1.slice(0, 28);
    let d = pc1.slice(28, 56);
    const subkeys = [];
    for (let round = 0; round < 16; round++) {
      const shift = SHIFTS[round];
      c = c.slice(shift).concat(c.slice(0, shift));
      d = d.slice(shift).concat(d.slice(0, shift));
      subkeys.push(permute(c.concat(d), PC2));
    }
    const decSubkeys = subkeys.slice().reverse();

    function feistel(r, subkey) {
      const er = permute(r, E);
      const xored = er.map((bit, i) => bit ^ subkey[i]);
      const sOutput = [];
      for (let i = 0; i < 8; i++) {
        const chunk = xored.slice(i * 6, (i + 1) * 6);
        const row = (chunk[0] << 1) | chunk[5];
        const col = (chunk[1] << 3) | (chunk[2] << 2) | (chunk[3] << 1) | chunk[4];
        const val = SBOX[i][row][col];
        for (let b = 3; b >= 0; b--) sOutput.push((val >> b) & 1);
      }
      return permute(sOutput, P);
    }

    function decryptBlock(blockBytes) {
      const bits = bytesToBits(blockBytes);
      const ip = permute(bits, IP);
      let l = ip.slice(0, 32);
      let r = ip.slice(32, 64);
      for (let round = 0; round < 16; round++) {
        const f = feistel(r, decSubkeys[round]);
        const nextL = r;
        const nextR = l.map((bit, i) => bit ^ f[i]);
        l = nextL;
        r = nextR;
      }
      const preOutput = r.concat(l);
      const fp = permute(preOutput, FP);
      return bitsToBytes(fp);
    }

    let cipherBytes;
    if (typeof Buffer !== 'undefined') {
      cipherBytes = [...Buffer.from(encryptedBase64, 'base64')];
    } else {
      const bin = atob(encryptedBase64);
      cipherBytes = new Array(bin.length);
      for (let i = 0; i < bin.length; i++) cipherBytes[i] = bin.charCodeAt(i);
    }

    const plainBytes = [];
    for (let i = 0; i < cipherBytes.length; i += 8) {
      const block = cipherBytes.slice(i, i + 8);
      if (block.length === 8) {
        plainBytes.push(...decryptBlock(block));
      }
    }

    // PKCS#5/7 unpad
    const pad = plainBytes[plainBytes.length - 1];
    if (pad >= 1 && pad <= 8) {
      plainBytes.splice(plainBytes.length - pad, pad);
    }

    return typeof Buffer !== 'undefined'
      ? Buffer.from(plainBytes).toString('utf8')
      : new TextDecoder().decode(new Uint8Array(plainBytes));
  } catch {
    return '';
  }
}

function decodeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&hellip;/g, '...')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Maps raw JioSaavn song JSON to Stark Track interface with high-res artwork and 320kbps stream URL.
 */
export function mapSaavnItemToTrack(s) {
  if (!s) return null;
  const id = String(s.id || s.song_id || Math.random());
  const title = decodeHtml(s.title || s.song || s.name || 'Unknown Track');

  let artist = 'Various Artists';
  if (s.subtitle && s.subtitle.includes('-')) {
    artist = decodeHtml(s.subtitle.split('-')[0].trim());
  } else if (s.subtitle) {
    artist = decodeHtml(s.subtitle);
  } else if (s.more_info?.singers) {
    artist = decodeHtml(s.more_info.singers);
  } else if (s.more_info?.primary_artists) {
    artist = decodeHtml(s.more_info.primary_artists);
  } else if (s.primary_artists) {
    artist = decodeHtml(s.primary_artists);
  }

  const album = decodeHtml(s.more_info?.album || s.album || '');
  const duration = parseInt(s.more_info?.duration || s.duration || '180', 10) || 180;

  // 500x500 high-res artwork
  let artwork = (s.image || '')
    .replace(/150x150\.jpg$/i, '500x500.jpg')
    .replace(/50x50\.jpg$/i, '500x500.jpg');

  // Stream URL resolution via DES decryption
  let streamUrl = '';
  const rawEncrypted = s.more_info?.encrypted_media_url || s.encrypted_media_url;
  if (rawEncrypted) {
    const decrypted = desDecrypt(rawEncrypted);
    if (decrypted) {
      streamUrl = decrypted.replace('_96.mp4', '_320.mp4');
    }
  }

  // Fallback to media_preview_url or standard aac if available
  if (!streamUrl && s.more_info?.media_preview_url) {
    streamUrl = s.more_info.media_preview_url.replace('_preview.mp4', '_320.mp4');
  }

  return {
    id: `saavn:${id}`,
    title,
    artist,
    album: album || undefined,
    artwork: artwork || undefined,
    artworkUrl: artwork || undefined,
    duration,
    streamUrl: streamUrl || undefined,
    provider: 'saavn',
    providerLabel: 'JioSaavn',
    isPreview: !streamUrl || streamUrl.includes('_preview'),
    genre: s.language || 'Indian',
    permalink: s.perma_url || undefined,
  };
}

const SAAVN_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Searches JioSaavn for tracks matching query string.
 */
export async function searchSaavn(query, limit = 20) {
  const q = String(query || '').trim();
  if (!q) return [];

  const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(q)}&n=${limit}&p=1`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': SAAVN_USER_AGENT,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`JioSaavn search failed with HTTP ${res.status}`);
  }

  const data = await res.json();
  const items = Array.isArray(data.results) ? data.results : [];
  return items.map(mapSaavnItemToTrack).filter((t) => t && t.title && t.id);
}

/**
 * Fetches trending Indian & Bollywood tracks.
 */
export async function getTrendingSaavn(limit = 20) {
  // Queries for top trending chart hits
  const queries = ['latest trending hindi songs', 'top bollywood hits', 'trending india'];
  for (const q of queries) {
    try {
      const tracks = await searchSaavn(q, limit);
      if (tracks && tracks.length > 0) return tracks;
    } catch {
      // Continue to next query
    }
  }
  return [];
}
