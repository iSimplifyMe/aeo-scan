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
