/** Rendered-HTML extraction helpers (ported from eldercare aeo-check.ts fetch mode + subdial counts). */

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
}

export function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return m ? decodeEntities(m[1]).trim() : null
}

/** Reads <meta name=...> or <meta property=...>, either attribute order. */
export function extractMeta(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, 'i')
  const tag = html.match(re)
  if (!tag) return null
  const content = tag[0].match(/content=["']([^"']*)["']/i)
  return content ? decodeEntities(content[1]).trim() : null
}

export function extractCanonical(html: string): string | null {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)
  if (!m) return null
  const href = m[0].match(/href=["']([^"']*)["']/i)
  return href ? href[1] : null
}

export function h1Count(html: string): number {
  return (html.match(/<h1[\s>]/gi) || []).length
}

export function h2Count(html: string): number {
  return (html.match(/<h2[\s>]/gi) || []).length
}

/** Count of atomic-answer blocks in the DOM (class or data-attribute convention). */
export function atomicAnswerCount(html: string, extraPattern?: string): number {
  const base =
    (html.match(/class=["'][^"']*atomic-answer[^"']*["']/gi) || []).length +
    (html.match(/data-atomic-answer/gi) || []).length
  if (!extraPattern) return base
  const extra = (html.match(new RegExp(extraPattern, 'gi')) || []).length
  return base + extra
}

/** FAQ question count from rendered markup (accordion module classes or <details>). */
export function renderedFaqCount(html: string): number {
  const moduleMatches = html.match(/FAQAccordion-module[^"']*question/gi) || []
  const detailsMatches = html.match(/<details[\s>]/gi) || []
  return Math.max(moduleMatches.length, detailsMatches.length)
}

// ---------------------------------------------------------------------------
// Extractors for the 0.1.0 scorecard (see score.ts). All regex-based — the
// zero-dependency rule means no DOM parser; each helper documents its
// approximation where one exists.
// ---------------------------------------------------------------------------

function stripTags(fragment: string): string {
  return decodeEntities(
    fragment.replace(/<(script|style|noscript|template|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

export interface Heading {
  level: number
  text: string
}

/** All h1–h6 in document order, inner tags stripped. */
export function headingSequence(html: string): Heading[] {
  const out: Heading[] = []
  const re = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    out.push({ level: Number(m[1]), text: stripTags(m[2]) })
  }
  return out
}

/** Headings (h2–h4) phrased as questions. */
export function questionHeadingCount(headings: Heading[]): number {
  return headings.filter((h) => h.level >= 2 && h.level <= 4 && h.text.trim().endsWith('?')).length
}

/** True when the sequence never skips a level downward (h2 → h4 is a skip). */
export function headingNestingClean(headings: Heading[]): boolean {
  let prev = 0
  for (const h of headings) {
    if (prev > 0 && h.level > prev + 1) return false
    prev = h.level
  }
  return true
}

/** Visible paragraph texts (non-empty <p> contents). */
export function paragraphTexts(html: string): string[] {
  const out: string[] = []
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const text = stripTags(m[1])
    if (text) out.push(text)
  }
  return out
}

/** Rough sentence count — terminal punctuation followed by space or end. */
export function sentenceCount(text: string): number {
  return text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0).length
}

export interface AnchorLink {
  href: string
  text: string
}

/** All <a href> links with their visible anchor text. */
export function anchorLinks(html: string): AnchorLink[] {
  const out: AnchorLink[] = []
  const re = /<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    out.push({ href: m[1], text: stripTags(m[2]) })
  }
  return out
}

/** Count of in-page anchor links (<a href="#...">) — the ToC signal. */
export function tocAnchorLinkCount(html: string): number {
  return anchorLinks(html).filter((a) => a.href.startsWith('#') && a.href.length > 1).length
}

export interface ImageAltStats {
  total: number
  missingAlt: number
}

/**
 * Images and how many lack an alt attribute entirely. An explicit alt="" is
 * intentional (decorative image, correct accessibility practice) and is NOT
 * counted as missing.
 */
export function imageAltStats(html: string): ImageAltStats {
  const imgs = html.match(/<img\b[^>]*>/gi) || []
  let missingAlt = 0
  for (const img of imgs) {
    if (!/\balt=["']/i.test(img)) missingAlt++
  }
  return { total: imgs.length, missingAlt }
}

export interface AtomicBlock {
  text: string
  words: number
  /** Nearest preceding h2–h4 text when it is question-phrased; null otherwise. */
  question: string | null
  charIndex: number
}

/**
 * Atomic-answer blocks with word counts and their preceding question heading.
 * Content runs to the first matching close tag — a nested same-name tag inside
 * a block undercounts (blocks conventionally contain only <p>, so this is
 * rare in practice).
 */
export function atomicBlocks(html: string): AtomicBlock[] {
  const out: AtomicBlock[] = []
  const re = /<(div|section|aside)\b[^>]*(?:class=["'][^"']*atomic-answer[^"']*["']|data-atomic-answer)[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const name = m[1].toLowerCase()
    const close = html.indexOf(`</${name}>`, re.lastIndex)
    if (close < 0) continue
    const text = stripTags(html.slice(re.lastIndex, close))
    const before = html.slice(0, m.index)
    let question: string | null = null
    const hRe = /<h([2-4])[^>]*>([\s\S]*?)<\/h\1>/gi
    let h: RegExpExecArray | null
    while ((h = hRe.exec(before))) {
      const t = stripTags(h[2])
      question = t.endsWith('?') ? t : null
    }
    out.push({ text, words: text ? text.split(/\s+/).filter(Boolean).length : 0, question, charIndex: m.index })
  }
  return out
}

/** Approximate visible word count of the whole document. */
export function bodyWordCount(html: string): number {
  const body = html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html
  const text = stripTags(body)
  return text ? text.split(/\s+/).filter(Boolean).length : 0
}
