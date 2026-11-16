/** Parser RSS/Atom ringan (tanpa dependency). Cukup untuk feed berita standar. */

export interface FeedItem {
  title: string;
  link: string;
  published: string | null;
  summary: string;
  image: string | null;
  author: string | null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function tag(block: string, name: string): string | null {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i");
  const m = block.match(re);
  if (!m) return null;
  let v = m[1].trim();
  const cdata = v.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) v = cdata[1];
  return v;
}

function attr(block: string, name: string, attrName: string): string | null {
  const m = block.match(new RegExp(`<${name}\\b[^>]*\\b${attrName}=["']([^"']+)["']`, "i"));
  return m ? decodeEntities(m[1]) : null;
}

function safeHttp(u: string | null): string | null {
  if (!u) return null;
  try {
    const x = new URL(u.trim());
    return x.protocol === "http:" || x.protocol === "https:" ? x.toString() : null;
  } catch {
    return null;
  }
}

export function parseFeed(xml: string, limit = 10): FeedItem[] {
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const blocks = xml.match(new RegExp(isAtom ? "<entry[\\s>][\\s\\S]*?</entry>" : "<item[\\s>][\\s\\S]*?</item>", "gi")) ?? [];
  const items: FeedItem[] = [];

  for (const b of blocks) {
    const title = stripTags(decodeEntities(tag(b, "title") ?? ""));
    const link = safeHttp(isAtom ? attr(b, "link", "href") : decodeEntities(tag(b, "link") ?? ""));
    if (!title || !link) continue;

    const rawDesc = tag(b, "description") ?? tag(b, "summary") ?? tag(b, "content") ?? tag(b, "content:encoded") ?? "";
    const desc = stripTags(decodeEntities(rawDesc));
    const img =
      attr(b, "enclosure", "url") ||
      attr(b, "media:content", "url") ||
      attr(b, "media:thumbnail", "url") ||
      (decodeEntities(rawDesc).match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null);

    const date = tag(b, "pubDate") ?? tag(b, "published") ?? tag(b, "updated") ?? tag(b, "dc:date");
    const ts = date ? Date.parse(decodeEntities(date)) : NaN;

    items.push({
      title,
      link,
      published: Number.isFinite(ts) ? new Date(ts).toISOString() : null,
      summary: desc.length > 280 ? `${desc.slice(0, 277)}…` : desc,
      image: safeHttp(img ? decodeEntities(img) : null),
      author: stripTags(decodeEntities(tag(b, "dc:creator") ?? tag(b, "author") ?? "")) || null,
    });
    if (items.length >= limit) break;
  }
  return items;
}
