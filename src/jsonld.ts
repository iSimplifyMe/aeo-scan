/**
 * JSON-LD extraction shared by fetch mode and the schema validator.
 *
 * Handles all three common shapes: a single node, a top-level array, and the
 * @graph container ({"@context":..., "@graph":[...]}). The @graph form is what
 * the legacy per-repo scanners missed — sites using it had every schema
 * falsely reported as absent (found on isimplifyme.com, 2026-07-10).
 */

export interface JsonLdBlock {
  raw: string
  parsed: unknown
  err?: string
}

export function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

export function extractJsonLd(html: string): JsonLdBlock[] {
  const out: JsonLdBlock[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const raw = m[1].trim()
    try {
      out.push({ raw, parsed: JSON.parse(raw) })
    } catch (e) {
      out.push({ raw, parsed: null, err: e instanceof Error ? e.message : String(e) })
    }
  }
  return out
}

/** Flatten a parsed JSON-LD payload into individual nodes, descending into @graph. */
export function flattenNodes(data: unknown): Record<string, unknown>[] {
  const top = Array.isArray(data) ? data : [data]
  const out: Record<string, unknown>[] = []
  for (const n of top) {
    if (!isObj(n)) continue
    out.push(n)
    if (Array.isArray(n['@graph'])) {
      for (const g of n['@graph']) if (isObj(g)) out.push(g)
    }
  }
  return out
}

/** All @type values present across blocks (string or array form), @graph-aware. */
export function schemaTypes(blocks: JsonLdBlock[]): Set<string> {
  const types = new Set<string>()
  for (const b of blocks) {
    if (b.err) continue
    for (const node of flattenNodes(b.parsed)) {
      const t = node['@type']
      if (typeof t === 'string') types.add(t)
      else if (Array.isArray(t)) for (const x of t) if (typeof x === 'string') types.add(x)
    }
  }
  return types
}

/** Total FAQPage Q&A count across blocks, @graph-aware. */
export function faqQuestionCount(blocks: JsonLdBlock[]): number {
  let count = 0
  for (const b of blocks) {
    if (b.err) continue
    for (const node of flattenNodes(b.parsed)) {
      if (node['@type'] === 'FAQPage' && Array.isArray(node['mainEntity'])) {
        count += node['mainEntity'].length
      }
    }
  }
  return count
}

/** True if any node carries a speakable block (voice-search eligibility). */
export function hasSpeakable(blocks: JsonLdBlock[]): boolean {
  for (const b of blocks) {
    if (b.err) continue
    for (const node of flattenNodes(b.parsed)) {
      if (node['speakable']) return true
    }
  }
  return false
}
