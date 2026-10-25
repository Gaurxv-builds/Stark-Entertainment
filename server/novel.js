/**
 * ZENKAI NOVEL ENGINE
 * Edge scraper for the APK novel sources (ported from zenkai-web, no invented placeholder chapter text):
 * 1. NovelFire (novelfire.net)
 * 2. NovelFull (novelfull.com via Jina proxy)
 * 3. WebNovel (novelfire / webnovel mirror)
 * 4. Lnori (lnori.com, light-novel volumes with illustrations)
 */

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function cleanText(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Curated Fallbacks if remote sources are temporarily blocked
const fallbackNovels = [
  { id: "shadow-slave", slug: "shadow-slave", title: "Shadow Slave", cover: "https://novelfire.net/server-1/shadow-slave.jpg", rating: "9.6", stats: "3200+ Chs", genres: ["Fantasy", "Action", "Supernatural", "Adventure"], format: "NOVEL", source: "novelfire" },
  { id: "lord-of-the-mysteries", slug: "lord-of-the-mysteries", title: "Lord of the Mysteries", cover: "https://novelfire.net/server-1/lord-of-the-mysteries.jpg", rating: "9.7", stats: "1430 Chs", genres: ["Fantasy", "Supernatural", "Adventure"], format: "NOVEL", source: "novelfire" },
  { id: "reverend-insanity", slug: "reverend-insanity", title: "Reverend Insanity", cover: "https://novelfire.net/server-1/reverend-insanity.jpg", rating: "9.5", stats: "2334 Chs", genres: ["Fantasy", "Action", "Adventure", "Supernatural"], format: "NOVEL", source: "novelfire" },
  { id: "solo-leveling", slug: "solo-leveling", title: "Solo Leveling", cover: "https://novelfire.net/server-1/solo-leveling.jpg", rating: "9.3", stats: "270 Chs", genres: ["Action", "Fantasy", "Supernatural"], format: "NOVEL", source: "novelfire" },
  { id: "the-legendary-mechanic", slug: "the-legendary-mechanic", title: "The Legendary Mechanic", cover: "https://novelfire.net/server-1/the-legendary-mechanic.jpg", rating: "9.6", stats: "1463 Chs", genres: ["Sci-Fi", "Action", "Adventure"], format: "NOVEL", source: "novelfire" },
  { id: "heaven-officials-blessing", slug: "heaven-officials-blessing", title: "Heaven Official's Blessing", cover: "https://novelfire.net/server-1/heaven-officials-blessing.jpg", rating: "9.8", stats: "244 Chs", genres: ["Romance", "Fantasy", "Supernatural"], format: "NOVEL", source: "novelfire" },
  { id: "omniscient-readers-viewpoint", slug: "omniscient-readers-viewpoint", title: "Omniscient Reader's Viewpoint", cover: "https://novelfire.net/server-1/omniscient-readers-viewpoint.jpg", rating: "9.8", stats: "551 Chs", genres: ["Action", "Supernatural", "Fantasy", "Sci-Fi"], format: "NOVEL", source: "novelfire" },
  { id: "super-gene", slug: "super-gene", title: "Super Gene", cover: "https://novelfire.net/server-1/super-gene.jpg", rating: "8.9", stats: "3462 Chs", genres: ["Sci-Fi", "Action", "Adventure", "Fantasy"], format: "NOVEL", source: "novelfire" },
  { id: "ending-maker", slug: "ending-maker", title: "Ending Maker", cover: "https://novelfire.net/server-1/ending-maker.jpg", rating: "9.5", stats: "350 Chs", genres: ["Romance", "Action", "Fantasy", "Adventure"], format: "NOVEL", source: "novelfire" },
  { id: "nano-machine", slug: "nano-machine", title: "Nano Machine", cover: "https://novelfire.net/server-1/nano-machine.jpg", rating: "9.4", stats: "483 Chs", genres: ["Sci-Fi", "Action", "Fantasy"], format: "NOVEL", source: "novelfire" },
  { id: "my-house-of-horrors", slug: "my-house-of-horrors", title: "My House of Horrors", cover: "https://novelfire.net/server-1/my-house-of-horrors.jpg", rating: "9.4", stats: "1208 Chs", genres: ["Supernatural", "Mystery", "Adventure"], format: "NOVEL", source: "novelfire" },
  { id: "tbate", slug: "the-beginning-after-the-end", title: "The Beginning After The End", cover: "https://novelfire.net/server-1/the-beginning-after-the-end.jpg", rating: "9.5", stats: "490 Chs", genres: ["Fantasy", "Action", "Adventure", "Romance"], format: "NOVEL", source: "novelfire" },
  { id: "supreme-magus", slug: "supreme-magus", title: "Supreme Magus", cover: "https://novelfire.net/server-1/supreme-magus.jpg", rating: "9.0", stats: "3100+ Chs", genres: ["Fantasy", "Action", "Adventure"], format: "NOVEL", source: "novelfire" },
  { id: "second-life-ranker", slug: "second-life-ranker", title: "Second Life Ranker", cover: "https://novelfire.net/server-1/second-life-ranker.jpg", rating: "9.3", stats: "800 Chs", genres: ["Action", "Fantasy", "Supernatural"], format: "NOVEL", source: "novelfire" },
  { id: "sss-class-suicide-hunter", slug: "sss-class-suicide-hunter", title: "SSS-Class Suicide Hunter", cover: "https://novelfire.net/server-1/sss-class-suicide-hunter.jpg", rating: "9.6", stats: "400 Chs", genres: ["Supernatural", "Action", "Fantasy"], format: "NOVEL", source: "novelfire" },
  { id: "overgeared", slug: "overgeared", title: "Overgeared", cover: "https://novelfire.net/server-1/overgeared.jpg", rating: "9.3", stats: "1950+ Chs", genres: ["Sci-Fi", "Action", "Fantasy", "Adventure"], format: "NOVEL", source: "novelfire" },
  { id: "release-that-witch", slug: "release-that-witch", title: "Release That Witch", cover: "https://novelfire.net/server-1/release-that-witch.jpg", rating: "9.4", stats: "1498 Chs", genres: ["Fantasy", "Sci-Fi", "Romance", "Adventure"], format: "NOVEL", source: "novelfire" },
  { id: "trash-of-the-counts-family", slug: "trash-of-the-counts-family", title: "Trash of the Count's Family", cover: "https://novelfire.net/server-1/trash-of-the-counts-family.jpg", rating: "9.6", stats: "850+ Chs", genres: ["Fantasy", "Adventure", "Supernatural"], format: "NOVEL", source: "novelfire" },
  { id: "against-the-gods", slug: "against-the-gods", title: "Against the Gods", cover: "https://novelfire.net/server-1/against-the-gods.jpg", rating: "9.0", stats: "2050+ Chs", genres: ["Action", "Fantasy", "Romance", "Adventure"], format: "NOVEL", source: "novelfire" },
  { id: "warlock-of-the-magus-world", slug: "warlock-of-the-magus-world", title: "Warlock of the Magus World", cover: "https://novelfire.net/server-1/warlock-of-the-magus-world.jpg", rating: "9.2", stats: "1200 Chs", genres: ["Fantasy", "Sci-Fi", "Action", "Supernatural"], format: "NOVEL", source: "novelfire" },
  { id: "martial-world", slug: "martial-world", title: "Martial World", cover: "https://novelfire.net/server-1/martial-world.jpg", rating: "9.3", stats: "2256 Chs", genres: ["Action", "Fantasy", "Adventure"], format: "NOVEL", source: "novelfire" },
  { id: "desolate-era", slug: "desolate-era", title: "Desolate Era", cover: "https://novelfire.net/server-1/desolate-era.jpg", rating: "9.2", stats: "1450 Chs", genres: ["Action", "Fantasy", "Adventure", "Supernatural"], format: "NOVEL", source: "novelfire" },
  { id: "coiling-dragon", slug: "coiling-dragon", title: "Coiling Dragon", cover: "https://novelfire.net/server-1/coiling-dragon.jpg", rating: "9.1", stats: "840 Chs", genres: ["Action", "Fantasy", "Adventure"], format: "NOVEL", source: "novelfire" },
  { id: "reformation-of-the-deadbeat-noble", slug: "reformation-of-the-deadbeat-noble", title: "Reformation of the Deadbeat Noble", cover: "https://novelfire.net/server-1/reformation-of-the-deadbeat-noble.jpg", rating: "9.3", stats: "350 Chs", genres: ["Fantasy", "Action", "Adventure"], format: "NOVEL", source: "novelfire" },
  { id: "the-tutorial-is-too-hard", slug: "the-tutorial-is-too-hard", title: "The Tutorial Is Too Hard", cover: "https://novelfire.net/server-1/the-tutorial-is-too-hard.jpg", rating: "9.1", stats: "420 Chs", genres: ["Action", "Supernatural", "Adventure"], format: "NOVEL", source: "novelfire" },
  { id: "martial-peak", slug: "martial-peak", title: "Martial Peak", cover: "https://novelfire.net/server-1/martial-peak.jpg", rating: "9.2", stats: "6000+ Chs", genres: ["Action", "Fantasy", "Adventure"], format: "NOVEL", source: "novelfire" },
  { id: "i-shall-seal-the-heavens", slug: "i-shall-seal-the-heavens", title: "I Shall Seal the Heavens", cover: "https://novelfire.net/server-1/i-shall-seal-the-heavens.jpg", rating: "9.4", stats: "1614 Chs", genres: ["Fantasy", "Action", "Adventure"], format: "NOVEL", source: "novelfire" },
  { id: "tomb-raider-king", slug: "tomb-raider-king", title: "Tomb Raider King", cover: "https://novelfire.net/server-1/tomb-raider-king.jpg", rating: "9.0", stats: "410 Chs", genres: ["Action", "Supernatural", "Adventure"], format: "NOVEL", source: "novelfire" },
  { id: "chrysalis", slug: "chrysalis", title: "Chrysalis", cover: "https://novelfire.net/server-1/chrysalis.jpg", rating: "9.1", stats: "1200+ Chs", genres: ["Fantasy", "Adventure", "Action"], format: "NOVEL", source: "novelfire" },
  { id: "perfect-world", slug: "perfect-world", title: "Perfect World", cover: "https://novelfire.net/server-1/perfect-world.jpg", rating: "9.2", stats: "2014 Chs", genres: ["Action", "Fantasy", "Adventure", "Supernatural"], format: "NOVEL", source: "novelfire" }
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. NOVELFIRE REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────
const NovelFire = {
  baseUrl: "https://novelphoenix.com",
  altBaseUrl: "https://novelfire.net",

  async fetchHtml(url) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": this.baseUrl
      }
    });
    if (!res.ok) throw new Error(`NovelFire fetch failed: ${res.status}`);
    const html = await res.text();
    const jsRedirect = html.match(/window\.location\.href\s*=\s*["']([^"']+)["']/i);
    if (jsRedirect) {
      const target = jsRedirect[1].replace(/\\/g, "");
      return await this.fetchHtml(target);
    }
    return html;
  },

  parseCards(html) {
    const list = [];
    const itemRegex = /<li[^>]*class=["'][^"']*novel-item[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
    const matches = [...html.matchAll(itemRegex)];

    for (const m of matches) {
      const block = m[1];
      const linkMatch = block.match(/href=["'](\/book\/[^"']+|\/novel\/[^"']+)["']/i);
      if (!linkMatch) continue;
      const slug = linkMatch[1].replace(/^\/(?:book|novel)\//, "").split("/")[0].split("?")[0].trim();
      if (!slug) continue;

      const titleMatch = block.match(/<h[345][^>]*class=["'][^"']*novel-title[^"']*["'][^>]*>([\s\S]*?)<\/h[345]>/i)
        || block.match(/title=["']([^"']+)["']/i);
      const title = titleMatch ? cleanText(titleMatch[1]) : slug.replace(/-/g, " ");

      const imgMatch = block.match(/data-src=["']([^"']+)["']/i) || block.match(/src=["']([^"']+)["']/i);
      let cover = imgMatch ? imgMatch[1] : "";
      if (cover && !cover.startsWith("http")) cover = this.baseUrl + (cover.startsWith("/") ? "" : "/") + cover;

      const statMatch = block.match(/<span[^>]*class=["'][^"']*chapter-count[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
      const stats = statMatch ? cleanText(statMatch[1]) : null;

      const rateMatch = block.match(/class=["'][^"']*rating[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
      const rating = rateMatch ? cleanText(rateMatch[1]) : "9.0";

      const matchedFb = fallbackNovels.find(f => f.slug === slug);
      const genres = matchedFb?.genres || ["Fantasy", "Action", "Adventure"];

      list.push({
        id: slug,
        slug,
        title,
        cover: cover || `https://novelfire.net/server-1/${slug}.jpg`,
        stats,
        rating,
        genres,
        format: "NOVEL",
        source: "novelfire"
      });
    }

    if (list.length === 0) {
      const bookRegex = /<a[^>]+href=["']\/(?:book|novel)\/([^"'\/?]+)["'][^>]*title=["']([^"']+)["'][^>]*>/gi;
      let bMatch;
      const seen = new Set();
      while ((bMatch = bookRegex.exec(html)) !== null) {
        const slug = bMatch[1];
        const title = cleanText(bMatch[2]);
        if (!seen.has(slug) && slug.length > 2 && !slug.includes("chapter")) {
          seen.add(slug);
          list.push({
            id: slug,
            slug,
            title,
            cover: `https://novelfire.net/server-1/${slug}.jpg`,
            format: "NOVEL",
            source: "novelfire"
          });
        }
      }
    }

    return list;
  },

  async getHome(page = 1) {
    try {
      const html = await this.fetchHtml(`${this.baseUrl}/ranking/top-rated?page=${page}`);
      const popular = this.parseCards(html);
      return {
        rankings: popular.slice(0, 10),
        popular: popular.length > 0 ? popular : fallbackNovels,
        latest: popular.slice(10),
        source: "novelfire"
      };
    } catch {
      return {
        rankings: fallbackNovels.slice(0, 5),
        popular: fallbackNovels,
        latest: fallbackNovels.slice(5),
        source: "novelfire"
      };
    }
  },

  async search(query, page = 1) {
    try {
      const html = await this.fetchHtml(`${this.baseUrl}/search?keyword=${encodeURIComponent(query)}&page=${page}`);
      return this.parseCards(html);
    } catch {
      return fallbackNovels.filter(n => n.title.toLowerCase().includes(query.toLowerCase()));
    }
  },

  async getDetail(slug) {
    try {
      let html = "";
      for (const u of [`${this.baseUrl}/novel/${slug}`, `${this.baseUrl}/book/${slug}`, `${this.altBaseUrl}/book/${slug}`]) {
        try {
          html = await this.fetchHtml(u);
          if (html && html.length > 500 && !html.includes("<title>Loading...</title>")) break;
        } catch {}
      }
      const titleMatch = html.match(/<h1[^>]*class=["'][^"']*novel-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
        || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const title = titleMatch ? cleanText(titleMatch[1]) : slug.replace(/-/g, " ");

      const imgMatch = html.match(/<figure[^>]*class=["'][^"']*cover[^"']*["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
      let cover = imgMatch ? imgMatch[1] : `https://novelfire.net/server-1/${slug}.jpg`;
      if (cover && !cover.startsWith("http")) cover = this.baseUrl + (cover.startsWith("/") ? "" : "/") + cover;

      const authorMatch = html.match(/href=["']\/author\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/i);
      const author = authorMatch ? cleanText(authorMatch[1]) : "Unknown";

      const synMatch = html.match(/<div[^>]*class=["'][^"']*summary[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
        || html.match(/<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
      const synopsis = synMatch ? cleanText(synMatch[1]) : "No synopsis available.";

      const genreRegex = /href=["']\/genre\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi;
      const genres = [];
      let gMatch;
      while ((gMatch = genreRegex.exec(html)) !== null) {
        genres.push(cleanText(gMatch[1]));
      }

      return {
        id: slug,
        slug,
        title,
        cover,
        author,
        synopsis,
        genres: [...new Set(genres)],
        source: "novelfire"
      };
    } catch {
      const found = fallbackNovels.find(n => n.slug === slug);
      return {
        id: slug,
        slug,
        title: found?.title || slug.replace(/-/g, " "),
        cover: found?.cover || `https://novelfire.net/server-1/${slug}.jpg`,
        author: "Unknown",
        synopsis: "Official novel translation from NovelFire.",
        genres: ["Fantasy", "Action"],
        source: "novelfire"
      };
    }
  },

  async getChapters(slug, page = 1) {
    try {
      let html = "";
      for (const u of [`${this.baseUrl}/novel/${slug}/chapters?page=1`, `${this.baseUrl}/novel/${slug}/chapters`, `${this.baseUrl}/book/${slug}/chapters?page=1`]) {
        try {
          html = await this.fetchHtml(u);
          if (html && html.includes("chapter-")) break;
        } catch {}
      }
      const chRegex = /<a[^>]+href=["']\/(?:book|novel)\/[^"']+\/(chapter-(\d+)[^"'\/?]*)["'][^>]*>([\s\S]*?)<\/a>/gi;
      const matches = [...html.matchAll(chRegex)];

      const knownChapters = new Map();
      let maxChNum = 0;

      for (const m of matches) {
        const chSlug = m[1];
        const num = parseInt(m[2], 10);
        const innerHtml = m[3] || "";
        const titleTagMatch = innerHtml.match(/<strong[^>]*class=["'][^"']*chapter-title[^"']*["'][^>]*>([\s\S]*?)<\/strong>/i)
          || innerHtml.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
        const title = titleTagMatch ? cleanText(titleTagMatch[1]) : cleanText(innerHtml);

        if (!isNaN(num) && num > 0) {
          if (num > maxChNum) maxChNum = num;
          if (!knownChapters.has(num) || (title && title.length > (knownChapters.get(num).title || "").length)) {
            knownChapters.set(num, {
              slug: chSlug,
              title: title || `Chapter ${num}`,
              number: String(num)
            });
          }
        }
      }

      // Check pagination links for maximum page number
      const pageMatches = [...html.matchAll(/page=(\d+)/g)].map(m => parseInt(m[1], 10));
      if (pageMatches.length > 0) {
        const maxPage = Math.max(...pageMatches);
        if (maxChNum <= 100 && maxPage > 1) {
          try {
            const lastPageHtml = await this.fetchHtml(`${this.baseUrl}/book/${slug}/chapters?page=${maxPage}`);
            const lastPageMatches = [...lastPageHtml.matchAll(chRegex)];
            for (const lm of lastPageMatches) {
              const lNum = parseInt(lm[2], 10);
              if (!isNaN(lNum) && lNum > maxChNum) {
                maxChNum = lNum;
              }
              if (!knownChapters.has(lNum)) {
                const lInner = lm[3] || "";
                const lTitleMatch = lInner.match(/<strong[^>]*class=["'][^"']*chapter-title[^"']*["'][^>]*>([\s\S]*?)<\/strong>/i)
                  || lInner.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
                knownChapters.set(lNum, {
                  slug: lm[1],
                  title: (lTitleMatch ? cleanText(lTitleMatch[1]) : cleanText(lInner)) || `Chapter ${lNum}`,
                  number: String(lNum)
                });
              }
            }
          } catch {}
        }
      }

      // Check curated database for chapter count
      const fb = fallbackNovels.find(f => f.slug === slug);
      if (fb && fb.stats) {
        const fbNum = parseInt(fb.stats.replace(/\D/g, ""), 10);
        if (!isNaN(fbNum) && fbNum > maxChNum) {
          maxChNum = fbNum;
        }
      }

      if (maxChNum === 0) {
        maxChNum = Math.max(matches.length, 30);
      }

      // Assemble complete list of all chapters
      const chapters = [];
      for (let i = 1; i <= maxChNum; i++) {
        if (knownChapters.has(i)) {
          chapters.push(knownChapters.get(i));
        } else {
          chapters.push({
            slug: `chapter-${i}`,
            title: `Chapter ${i}`,
            number: String(i)
          });
        }
      }

      return {
        slug,
        total: chapters.length,
        totalPages: Math.ceil(chapters.length / 100),
        chapters,
        source: "novelfire"
      };
    } catch {
      const fb = fallbackNovels.find(f => f.slug === slug);
      let count = 40;
      if (fb && fb.stats) {
        const n = parseInt(fb.stats.replace(/\D/g, ""), 10);
        if (!isNaN(n) && n > 0) count = n;
      }
      const chapters = [];
      for (let i = 1; i <= count; i++) {
        chapters.push({ slug: `chapter-${i}`, title: `Chapter ${i}`, number: `${i}` });
      }
      return { slug, total: chapters.length, totalPages: Math.ceil(chapters.length / 100), chapters, source: "novelfire" };
    }
  },

  async getChapterContent(novelSlug, chapterSlug) {
    try {
      const urls = [
        `${this.baseUrl}/novel/${novelSlug}/${chapterSlug}`,
        `${this.baseUrl}/book/${novelSlug}/${chapterSlug}`,
        `${this.altBaseUrl}/book/${novelSlug}/${chapterSlug}`
      ];
      let html = "";
      for (const u of urls) {
        try {
          html = await this.fetchHtml(u);
          if (html && html.includes("<p")) break;
        } catch {}
      }

      if (html) {
        const titleMatch = html.match(/<span[^>]*class=["'][^"']*chapter-title[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
          || html.match(/<h[12][^>]*class=["'][^"']*chapter-title[^"']*["'][^>]*>([\s\S]*?)<\/h[12]>/i)
          || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        const title = titleMatch ? cleanText(titleMatch[1]) : chapterSlug.replace(/-/g, " ");

        const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
          .map(m => cleanText(m[1]))
          .filter(p => p.length > 20 && !p.startsWith("To comply with copyright") && !p.includes("NovelFire") && !p.includes("novelphoenix"));

        if (paragraphs.length > 0) {
          const currentNum = parseInt(chapterSlug.replace(/\D/g, ""), 10) || 1;
          return {
            novelSlug,
            chapterSlug,
            title,
            paragraphs,
            prevChapterSlug: currentNum > 1 ? `chapter-${currentNum - 1}` : null,
            nextChapterSlug: `chapter-${currentNum + 1}`,
            source: "novelfire"
          };
        }
      }

      // Source fallback: attempt NovelFull
      try {
        const nfRes = await NovelFull.getChapterContent(novelSlug, chapterSlug);
        if (nfRes.paragraphs && nfRes.paragraphs.length > 0) {
          return { ...nfRes, source: "novelfire" };
        }
      } catch {}

      const currentNum = parseInt(chapterSlug.replace(/\D/g, ""), 10) || 1;
      return {
        novelSlug,
        chapterSlug,
        title: `Chapter ${currentNum}`,
        paragraphs: [],
        error: "Chapter text could not be loaded from this source.",
        prevChapterSlug: currentNum > 1 ? `chapter-${currentNum - 1}` : null,
        nextChapterSlug: `chapter-${currentNum + 1}`,
        source: "novelfire"
      };
    } catch (err) {
      const currentNum = parseInt(chapterSlug.replace(/\D/g, ""), 10) || 1;
      return {
        novelSlug,
        chapterSlug,
        title: `Chapter ${currentNum}`,
        paragraphs: [],
        error: "Chapter text could not be loaded from this source.",
        prevChapterSlug: currentNum > 1 ? `chapter-${currentNum - 1}` : null,
        nextChapterSlug: `chapter-${currentNum + 1}`,
        source: "novelfire"
      };
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. NOVELFULL REPOSITORY (via Jina Reader Proxy for Cloudflare Bypass)
// ─────────────────────────────────────────────────────────────────────────────
const NovelFull = {
  baseUrl: "http://novelfull.com",
  jinaBase: "https://r.jina.ai/http://novelfull.com",

  async fetchJina(path) {
    const url = `${this.jinaBase}${path}`;
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": USER_AGENT
      }
    });
    if (!res.ok) throw new Error(`NovelFull fetch failed: ${res.status}`);
    const json = await res.json();
    return json?.data?.content || "";
  },

  parseJinaCards(text) {
    const list = [];
    const regex = /### \[([^\]]+)\]\((?:https?:\/\/novelfull\.com\/)?([^)]+?)\.html[^)]*\)/gi;
    let match;
    const seen = new Set();
    while ((match = regex.exec(text)) !== null) {
      const title = cleanText(match[1]);
      const slug = match[2].trim();
      if (!seen.has(slug) && slug.length > 2 && !slug.includes("genre") && !slug.includes("contact")) {
        seen.add(slug);
        list.push({
          id: slug,
          slug,
          title,
          cover: `https://novelfull.com/uploads/novel/${slug}.jpg`,
          stats: "Popular",
          rating: "9.2",
          format: "NOVEL",
          source: "novelfull"
        });
      }
    }
    return list;
  },

  async getHome(page = 1) {
    try {
      const text = await this.fetchJina(page <= 1 ? "/most-popular" : `/most-popular?page=${page}`);
      const popular = this.parseJinaCards(text);
      if (popular.length > 0) {
        return {
          rankings: popular.slice(0, 10),
          popular,
          latest: popular.slice(10),
          source: "novelfull"
        };
      }
    } catch (e) {
      console.warn("NovelFull getHome error, falling back:", e.message);
    }
    return {
      rankings: fallbackNovels.slice(0, 5).map(n => ({ ...n, source: "novelfull" })),
      popular: fallbackNovels.map(n => ({ ...n, source: "novelfull" })),
      latest: fallbackNovels.slice(5).map(n => ({ ...n, source: "novelfull" })),
      source: "novelfull"
    };
  },

  async search(query, page = 1) {
    try {
      const text = await this.fetchJina(`/search?keyword=${encodeURIComponent(query)}&page=${page}`);
      const results = this.parseJinaCards(text);
      if (results.length > 0) return results;
    } catch {}
    return fallbackNovels
      .filter(n => n.title.toLowerCase().includes(query.toLowerCase()))
      .map(n => ({ ...n, source: "novelfull" }));
  },

  async getDetail(slug) {
    try {
      const text = await this.fetchJina(`/${slug}.html`);
      const lines = text.split("\n");
      const title = lines.find(l => l.startsWith("# "))?.replace("# ", "").trim() || slug.replace(/-/g, " ");
      const author = lines.find(l => l.includes("Author:"))?.replace(/.*Author:\s*/, "").trim() || "Unknown";
      const descLines = lines.filter(l => l.length > 40 && !l.includes("NovelFull") && !l.includes("Show menu"));

      return {
        id: slug,
        slug,
        title,
        cover: `https://novelfull.com/uploads/novel/${slug}.jpg`,
        author,
        synopsis: descLines.slice(0, 3).join("\n\n") || "Read full light novel on Zenkai.",
        genres: ["Fantasy", "Action", "Adventure"],
        source: "novelfull"
      };
    } catch {
      return {
        id: slug,
        slug,
        title: slug.replace(/-/g, " ").toUpperCase(),
        cover: `https://novelfire.net/cover/${slug}.jpg`,
        author: "Unknown",
        synopsis: "Official Light Novel from NovelFull archive.",
        genres: ["Fantasy", "Action"],
        source: "novelfull"
      };
    }
  },

  async getChapters(slug, page = 1) {
    try {
      const nfRes = await NovelFire.getChapters(slug, page);
      if (nfRes && nfRes.chapters && nfRes.chapters.length > 40) {
        return { ...nfRes, source: "novelfull" };
      }
    } catch {}

    const fb = fallbackNovels.find(f => f.slug === slug);
    let count = 60;
    if (fb && fb.stats) {
      const n = parseInt(fb.stats.replace(/\D/g, ""), 10);
      if (!isNaN(n) && n > 0) count = n;
    }
    const chapters = [];
    for (let i = 1; i <= count; i++) {
      chapters.push({
        slug: `chapter-${i}`,
        title: `Chapter ${i}`,
        number: `${i}`
      });
    }
    return { slug, total: chapters.length, totalPages: Math.ceil(chapters.length / 100), chapters, source: "novelfull" };
  },

  async getChapterContent(novelSlug, chapterSlug) {
    try {
      const cleanSlug = chapterSlug.includes(".html") ? chapterSlug : `${chapterSlug}.html`;
      const text = await this.fetchJina(`/${novelSlug}/${cleanSlug}`);
      const rawParas = text.split("\n\n")
        .map(p => p.trim())
        .filter(p => p.length > 25 && !p.includes("Show menu") && !p.includes("Novelfull") && !p.startsWith("###"));

      const currentNum = parseInt(chapterSlug.replace(/\D/g, ""), 10) || 1;
      return {
        novelSlug,
        chapterSlug,
        title: `Chapter ${currentNum}`,
        paragraphs: rawParas,
        error: rawParas.length ? undefined : "Chapter text could not be loaded from this source.",
        prevChapterSlug: currentNum > 1 ? `chapter-${currentNum - 1}` : null,
        nextChapterSlug: `chapter-${currentNum + 1}`,
        source: "novelfull"
      };
    } catch {
      const currentNum = parseInt(chapterSlug.replace(/\D/g, ""), 10) || 1;
      return {
        novelSlug,
        chapterSlug,
        title: `Chapter ${currentNum}`,
        paragraphs: [], error: "Chapter text could not be loaded from this source.",
        prevChapterSlug: currentNum > 1 ? `chapter-${currentNum - 1}` : null,
        nextChapterSlug: `chapter-${currentNum + 1}`,
        source: "novelfull"
      };
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. WEBNOVEL REPOSITORY (Alternate Mirror)
// ─────────────────────────────────────────────────────────────────────────────
const WebNovel = {
  ...NovelFire,
  async getHome(page = 1) {
    const res = await NovelFire.getHome(page);
    return {
      ...res,
      source: "webnovel",
      popular: res.popular.map(p => ({ ...p, source: "webnovel" }))
    };
  },
  async search(query, page = 1) {
    const res = await NovelFire.search(query, page);
    return res.map(p => ({ ...p, source: "webnovel" }));
  },
  async getDetail(slug) {
    const res = await NovelFire.getDetail(slug);
    return { ...res, source: "webnovel" };
  },
  async getChapters(slug, page = 1) {
    const res = await NovelFire.getChapters(slug, page);
    return { ...res, source: "webnovel" };
  },
  async getChapterContent(novelSlug, chapterSlug) {
    const res = await NovelFire.getChapterContent(novelSlug, chapterSlug);
    return { ...res, source: "webnovel" };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. LNORI REPOSITORY (light-novel library, https://lnori.com)
//    Port of the Android app's LnoriRepository.kt. Workers have no DOM/Jsoup, so the same
//    selectors are applied with small regex helpers. A "chapter" here is one light-novel VOLUME;
//    its text can contain images, which are emitted as "[img]url[/img]" paragraphs.
//    Slugs never contain "/" (it is swapped for "~") so they survive being a single URL segment:
//      series  "3343/re-zero-…"        <->  "3343~re-zero-…"
//      volume  "book/12040/some-slug"  <->  "12040~some-slug"
// ─────────────────────────────────────────────────────────────────────────────
const decodeEntities = (s = "") =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/** All attributes of one opening tag, lower-cased names, entity-decoded values. */
function tagAttrs(openTag) {
  const out = {};
  for (const m of openTag.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? "");
  return out;
}

const hasClass = (attrs, cls) => (attrs.class || "").split(/\s+/).includes(cls);

const Lnori = {
  baseUrl: "https://lnori.com",
  cdn: "https://cdn.lnori.com",
  _catalog: null,
  _catalogAt: 0,
  _inflight: null,

  absolute(u) {
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith("//")) return "https:" + u;
    return this.cdn + (u.startsWith("/") ? "" : "/") + u;
  },
  site(u) {
    if (!u) return "";
    return /^https?:\/\//i.test(u) ? u : this.baseUrl + (u.startsWith("/") ? "" : "/") + u;
  },

  async fetchHtml(url) {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Referer": this.baseUrl },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Lnori fetch failed: ${res.status} for ${url}`);
    return await res.text();
  },

  /** Every <article ...>…</article> block as { attrs, html }. */
  articles(html) {
    const list = [];
    for (const m of html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)) list.push({ attrs: tagAttrs(m[1]), html: m[2] });
    return list;
  },

  /** Best real URL of one <img> tag: lazy-load attributes beat a data: placeholder; srcset is the last resort. */
  imgSrc(tag) {
    const a = tagAttrs(tag);
    const pick = [a["data-src"], a["data-lazy-src"], a["data-original"], a["data-url"], a.src].find((v) => v && !/^data:/i.test(v.trim()));
    let src = (pick || "").trim();
    if (!src && a.srcset) src = (a.srcset.split(",")[0] || "").trim().split(/\s+/)[0];
    if (!src && a["data-srcset"]) src = (a["data-srcset"].split(",")[0] || "").trim().split(/\s+/)[0];
    if (!src) return "";
    if (/^https?:\/\//i.test(src) || src.startsWith("//")) return this.absolute(src);
    // relative: image folders live on the CDN, anything else on the site
    return /^\/?(volume|cover|covers|img|images|illust|assets)\//i.test(src) ? this.absolute(src) : this.site(src);
  },

  firstImage(html) {
    const tag = html.match(/<img\b[^>]*>/i)?.[0];
    return tag ? this.imgSrc(tag) : "";
  },

  /** "/series/3343/re-zero" -> "3343~re-zero" */
  seriesSlug(href) {
    const rest = href.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/?series\//, "").replace(/^\/+|\/+$/g, "").split("?")[0];
    return rest.replace(/\//g, "~");
  },
  seriesPath(slug) {
    return String(slug).replace(/^\/?series\//, "").replace(/~/g, "/");
  },
  /** "/book/12040/some-slug" -> "12040~some-slug" */
  bookSlug(href) {
    const rest = href.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/?book\//, "").replace(/^\/+|\/+$/g, "").split("?")[0];
    return rest.replace(/\//g, "~");
  },
  bookPath(slug) {
    return String(slug).replace(/^\/?book\//, "").replace(/~/g, "/");
  },

  async getCatalog() {
    if (this._catalog && Date.now() - this._catalogAt < 3600e3) return this._catalog;
    if (this._inflight) return this._inflight;
    this._inflight = (async () => {
      try {
        const html = await this.fetchHtml(`${this.baseUrl}/library`);
        const entries = [];
        const seen = new Set();
        for (const { attrs, html: inner } of this.articles(html)) {
          if (!hasClass(attrs, "card") || !attrs["data-id"]) continue;
          const id = attrs["data-id"].trim();
          if (!id || seen.has(id)) continue;

          let title = (attrs["data-t"] || "").trim();
          if (!title) title = cleanText(inner.match(/<(?:h2|h3)\b[^>]*>([\s\S]*?)<\/(?:h2|h3)>/i)?.[1] || "");
          if (!title) continue;

          const href = inner.match(/<a\b[^>]*href=["']([^"']*\/series\/[^"']*)["']/i)?.[1] || "";
          const slug = (href ? this.seriesSlug(href) : "") || id;
          const desc = cleanText(inner.match(/<[^>]*class=["'][^"']*(?:popup-description|card-description)[^"']*["'][^>]*>([\s\S]*?)<\/[a-z0-9]+>/i)?.[1] || "");

          seen.add(id);
          entries.push({
            id,
            slug,
            title: decodeEntities(title),
            author: (attrs["data-a"] || "").trim(),
            year: (attrs["data-d"] || "").trim(),
            volumes: parseInt(attrs["data-v"], 10) || 1,
            tags: (attrs["data-tags"] || "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
            relevance: parseInt(attrs["data-rel"], 10) || 0,
            cover: this.firstImage(inner),
            description: desc,
          });
        }
        if (entries.length) {
          this._catalog = entries;
          this._catalogAt = Date.now();
          return entries;
        }
      } catch (e) {
        console.warn("Lnori catalog error:", e.message);
      } finally {
        this._inflight = null;
      }
      return this._catalog || [];
    })();
    return this._inflight;
  },

  toItem(e) {
    const stats = [e.volumes > 0 ? `${e.volumes} Vols` : "", e.year, e.author].filter(Boolean).join(" • ");
    return {
      id: e.slug,
      slug: e.slug,
      title: e.title,
      cover: e.cover,
      stats: stats || null,
      rating: null,
      genres: e.tags.slice(0, 6).map((t) => t.replace(/\b\w/g, (c) => c.toUpperCase())),
      format: "LIGHT NOVEL",
      source: "lnori",
    };
  },

  byRelevance(list) {
    return [...list].sort((a, b) => b.relevance - a.relevance);
  },
  byNewest(list) {
    const key = (e) => (parseInt(e.year, 10) || 0) * 1e6 + (parseInt(e.id, 10) || 0);
    return [...list].sort((a, b) => key(b) - key(a));
  },

  async getHome(page = 1) {
    const catalog = await this.getCatalog();
    if (!catalog.length) throw new Error("Lnori library is unreachable right now");
    const pop = this.byRelevance(catalog);
    const start = (Math.max(1, page) - 1) * 30;
    return {
      rankings: pop.slice(0, 15).map((e) => this.toItem(e)),
      popular: pop.slice(start, start + 30).map((e) => this.toItem(e)),
      latest: this.byNewest(catalog).slice(0, 30).map((e) => this.toItem(e)),
      source: "lnori",
    };
  },

  async search(query, page = 1) {
    const q = String(query || "").trim().toLowerCase();
    const catalog = await this.getCatalog();
    const hits = q
      ? catalog.filter((e) => e.title.toLowerCase().includes(q) || e.author.toLowerCase().includes(q) || e.tags.some((t) => t.includes(q)))
      : catalog;
    const rank = (e) => (e.title.toLowerCase() === q ? 3 : e.title.toLowerCase().startsWith(q) ? 2 : e.title.toLowerCase().includes(q) ? 1 : 0);
    hits.sort((a, b) => rank(b) - rank(a) || b.relevance - a.relevance);
    return hits.slice((Math.max(1, page) - 1) * 24, Math.max(1, page) * 24).map((e) => this.toItem(e));
  },

  async resolveSeriesUrl(slug) {
    const path = this.seriesPath(slug);
    if (path.includes("/")) return `${this.baseUrl}/series/${path}`;
    const hit = (await this.getCatalog()).find((e) => e.id === path || e.slug.startsWith(`${path}~`) || e.slug === path);
    return `${this.baseUrl}/series/${hit ? hit.slug.replace(/~/g, "/") : path}`;
  },

  /** Volumes of a series page: HTML cards first, then JSON-LD hasPart, then bare /book/ links. */
  parseVolumes(html) {
    const out = [];
    const seen = new Set();
    const push = (href, title, cover) => {
      const slug = this.bookSlug(href);
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      const n = out.length + 1;
      out.push({ slug, title: title || `Volume ${n}`, number: String(n), cover: cover || null });
    };

    for (const { attrs, html: inner } of this.articles(html)) {
      if (!hasClass(attrs, "card") && !attrs["data-id"]) continue;
      const a = inner.match(/<a\b[^>]*href=["']([^"']*\/book\/[^"']*)["'][^>]*>/i);
      if (!a) continue;
      const aAttrs = tagAttrs(a[0]);
      const title = cleanText(inner.match(/<[^>]*class=["'][^"']*(?:card-title|popup-title)[^"']*["'][^>]*>([\s\S]*?)<\/[a-z0-9]+>/i)?.[1] || "") || (aAttrs["aria-label"] || "").trim();
      const vol = (attrs["data-id"] || "").trim();
      push(a[1], decodeEntities(title), this.firstImage(inner) || (vol ? `${this.cdn}/cover/${vol}.webp` : ""));
    }
    if (out.length) return out;

    for (const m of html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const obj = JSON.parse(m[1].trim());
        for (const part of obj.hasPart || []) {
          if (!part?.url) continue;
          const vol = this.bookSlug(part.url).split("~")[0];
          push(part.url, String(part.name || "").trim(), /^\d+$/.test(vol) ? `${this.cdn}/cover/${vol}.webp` : "");
        }
      } catch {}
      if (out.length) return out;
    }

    for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']*\/book\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const text = cleanText(m[2]);
      const vol = this.bookSlug(m[1]).split("~")[0];
      push(m[1], text && !/start reading/i.test(text) ? text : "", /^\d+$/.test(vol) ? `${this.cdn}/cover/${vol}.webp` : "");
    }
    return out;
  },

  async getDetail(slug) {
    const url = await this.resolveSeriesUrl(slug);
    let html;
    try {
      html = await this.fetchHtml(url);
    } catch {
      throw new Error("Series not found on Lnori");
    }

    let title = "", author = "", desc = "", cover = "", genres = [], parts = 0;
    for (const m of html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const obj = JSON.parse(m[1].trim());
        if (obj["@type"] !== "Book") continue;
        title = String(obj.name || "").trim();
        author = (typeof obj.author === "object" ? obj.author?.name : obj.author) || "";
        desc = String(obj.description || "");
        cover = typeof obj.image === "string" ? obj.image : obj.image?.url || "";
        genres = Array.isArray(obj.genre) ? obj.genre.map(String) : obj.genre ? [String(obj.genre)] : [];
        parts = Array.isArray(obj.hasPart) ? obj.hasPart.length : 0;
        break;
      } catch {}
    }

    const volumes = this.parseVolumes(html);
    if (!title) title = cleanText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
    if (!title || /404|not found/i.test(title)) throw new Error("Series not found on Lnori");
    if (!parts && !volumes.length && !desc) throw new Error("Series not found on Lnori");
    if (!author) author = cleanText(html.match(/<[^>]*class=["'][^"']*(?:hero-author|author)[^"']*["'][^>]*>([\s\S]*?)<\/[a-z0-9]+>/i)?.[1] || "");
    if (!desc) desc = cleanText(html.match(/<[^>]*class=["'][^"']*(?:description|synopsis)[^"']*["'][^>]*>([\s\S]*?)<\/[a-z0-9]+>/i)?.[1] || html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");

    // The library card has the authentic portrait cover; the series page often only has a wide hero.
    const key = this.seriesPath(slug).split("/")[0];
    const entry = (await this.getCatalog()).find((e) => e.id === key || e.slug === slug || e.slug.startsWith(`${key}~`));
    if (entry?.cover) cover = entry.cover;
    if (!cover || cover.includes("/series/")) cover = this.firstImage(html.match(/<(?:div|figure)\b[^>]*class=["'][^"']*(?:hero-card|cover-wrap|card-cover|series-cover|cover)[^"']*["'][\s\S]*?<\/(?:div|figure)>/i)?.[0] || "") || cover;
    if ((!cover || cover.includes("/series/")) && volumes[0]?.cover) cover = volumes[0].cover;

    return {
      id: slug,
      slug,
      title: decodeEntities(title),
      cover: this.absolute(cover),
      author: decodeEntities(author) || entry?.author || "Unknown",
      synopsis: decodeEntities(desc) || entry?.description || "No synopsis available.",
      genres: (genres.length ? genres : entry?.tags || []).slice(0, 10).map((g) => String(g).replace(/\b\w/g, (c) => c.toUpperCase())),
      source: "lnori",
    };
  },

  async getChapters(slug) {
    const url = await this.resolveSeriesUrl(slug);
    let volumes = [];
    try {
      volumes = this.parseVolumes(await this.fetchHtml(url));
    } catch {}
    return { slug, total: volumes.length, totalPages: 1, chapters: volumes, source: "lnori" };
  },

  async getChapterContent(novelSlug, chapterSlug) {
    const fail = (error) => ({ novelSlug, chapterSlug, title: "Volume", paragraphs: [], error, prevChapterSlug: null, nextChapterSlug: null, source: "lnori" });
    const path = this.bookPath(chapterSlug);
    let html;
    try {
      html = await this.fetchHtml(`${this.baseUrl}/book/${path}`);
    } catch {
      return fail("This volume could not be loaded from Lnori.");
    }

    const title = cleanText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "") || `Volume ${path.split("/")[0]}`;
    const body =
      html.match(/<article\b[^>]*class=["'][^"']*content-body[^"']*["'][^>]*>([\s\S]*?)<\/article>/i)?.[1] ||
      html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ||
      html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ||
      "";
    if (!body) return fail("This volume has no readable text.");

    const BAD_IMG = /avatar|favicon|\/icons?\/|\.ico(\?|$)|logo|spinner|loading\.|pixel\.gif/i;
    const paragraphs = [];
    const seenImg = new Set();
    const addImg = (tag) => {
      const src = this.imgSrc(tag);
      if (!src || BAD_IMG.test(src) || seenImg.has(src)) return;
      seenImg.add(src);
      paragraphs.push(`[img]${src}[/img]`);
    };

    // cover first
    const cover = html.match(/<img\b[^>]*(?:src|data-src)=["'][^"']*\/volume\/[^"']*["'][^>]*>/i)?.[0];
    const og = html.match(/<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1];
    if (cover) addImg(cover);
    else if (og) {
      const src = this.absolute(decodeEntities(og));
      seenImg.add(src);
      paragraphs.push(`[img]${src}[/img]`);
    }

    // illustrations that sit in the page before the text body (character sheets, colour plates, ...)
    const bodyAt = html.search(/<article\b[^>]*class=["'][^"']*content-body/i);
    if (bodyAt > 0) {
      for (const m of html.slice(0, bodyAt).matchAll(/<img\b[^>]*>/gi)) if (/cdn\.lnori\.com/i.test(this.imgSrc(m[0]))) addImg(m[0]);
    }

    // the body, in reading order: headings, paragraphs (text and any number of images inside), rules, bare images
    const text = (t) => {
      const v = cleanText(decodeEntities(t));
      if (v) paragraphs.push(v);
    };
    const clean = body.replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, "");
    for (const m of clean.matchAll(/<(h[1-6]|p|figure)\b[^>]*>([\s\S]*?)<\/\1>|<hr\b[^>]*>|<img\b[^>]*>/gi)) {
      const tag = (m[1] || m[0].match(/^<(\w+)/)[1]).toLowerCase();
      if (tag === "hr") paragraphs.push("* * *");
      else if (tag === "img") addImg(m[0]);
      else if (tag === "p" || tag === "figure") {
        // walk the inner html so text and images keep their order
        let last = 0;
        const inner = m[2];
        for (const im of inner.matchAll(/<img\b[^>]*>/gi)) {
          text(inner.slice(last, im.index));
          addImg(im[0]);
          last = im.index + im[0].length;
        }
        text(inner.slice(last));
      } else {
        const t = cleanText(decodeEntities(m[2]));
        if (t && t.length < 120) paragraphs.push(`== ${t} ==`);
      }
    }

    return {
      novelSlug,
      chapterSlug,
      title,
      paragraphs,
      error: paragraphs.length ? undefined : "This volume has no readable text.",
      prevChapterSlug: null,
      nextChapterSlug: null,
      source: "lnori",
    };
  },
};

export default {
  getSource(src = "novelfire") {
    const s = (src || "novelfire").toLowerCase().trim();
    if (s === "lnori") return Lnori;
    if (s === "novelfull") return NovelFull;
    if (s === "webnovel") return WebNovel;
    return NovelFire;
  },
  /** exposed for tests */
  _internals: { Lnori, tagAttrs }
};
