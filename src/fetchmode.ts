/** Fetch mode: audit rendered HTML per route (ported from eldercare v2 + subdial counts). */

import type { AeoScanConfig } from './config.js'
import {
  extractTitle,
  extractMeta,
  extractCanonical,
  h1Count,
  h2Count,
  atomicAnswerCount,
  renderedFaqCount,
} from './html.js'
import { extractJsonLd, schemaTypes, faqQuestionCount, hasSpeakable } from './jsonld.js'
import { validateBlocks, DEFAULT_REQUIRED, type Issue } from './schema.js'
import { detectHiddenText, type GateViolation } from './gating.js'
import { buildScorecard, type Scorecard } from './score.js'

export interface FetchResult {
  route: string
  status: number
  title: string | null
  titleLen: number
  description: string | null
  descriptionLen: number
  canonical: string | null
  h1Count: number
  h2Count: number
  atomicCount: number
  faqRendered: number
  faqSchemaQuestions: number
  ogTitle: string | null
  ogDesc: string | null
  ogImage: string | null
  schemaCount: number
  schemaTypes: string[]
  speakable: boolean
  /** Milliseconds to fetch the document (not a full-page load metric). */
  elapsedMs: number
  /** Hidden-text gate violations — any entry is an automatic REJECT. */
  gate: GateViolation[]
  /** AEO Standard scorecard (mechanical checks); null when the fetch failed. */
  scorecard: Scorecard | null
  issues: Issue[]
}

/** Substitute dynamic segments ([slug]) with representative values from config. */
export function concreteRoutes(discovered: string[], substitutions: Record<string, string>): string[] {
  return discovered.map((r) => {
    let out = r
    for (const [seg, value] of Object.entries(substitutions)) {
      out = out.split(seg).join(value)
    }
    return out
  })
}

export async function auditRoute(base: string, route: string, config: AeoScanConfig): Promise<FetchResult> {
  // Cache-buster defeats CDN-stale HTML on prod audits (ported from the
  // roofing/afterloss legacy scripts during the 2026-07 unification).
  const bust = config.fetch.cacheBust
    ? `${route.includes('?') ? '&' : '?'}aeocb=${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    : ''
  const url = base.replace(/\/$/, '') + route + bust
  const issues: Issue[] = []
  const empty: FetchResult = {
    route, status: 0, title: null, titleLen: 0, description: null, descriptionLen: 0,
    canonical: null, h1Count: 0, h2Count: 0, atomicCount: 0, faqRendered: 0,
    faqSchemaQuestions: 0, ogTitle: null, ogDesc: null, ogImage: null,
    schemaCount: 0, schemaTypes: [], speakable: false,
    elapsedMs: 0, gate: [], scorecard: null, issues,
  }

  let status = 0
  let html = ''
  const t0 = Date.now()
  try {
    const r = await fetch(url, { headers: { 'User-Agent': config.fetch.userAgent } })
    status = r.status
    html = await r.text()
  } catch (e) {
    issues.push({ route, level: 'error', message: `fetch failed: ${e instanceof Error ? e.message : String(e)}` })
    return empty
  }
  const elapsedMs = Date.now() - t0
  if (status !== 200) issues.push({ route, level: 'error', message: `HTTP ${status}` })

  const { titleMin, titleMax, descMin, descMax } = config.fetch
  const title = extractTitle(html)
  const description = extractMeta(html, 'description')
  const canonical = extractCanonical(html)
  const h1s = h1Count(html)
  const ogTitle = extractMeta(html, 'og:title')
  const ogDesc = extractMeta(html, 'og:description')
  const ogImage = extractMeta(html, 'og:image')

  if (!title) issues.push({ route, level: 'error', message: 'missing <title>' })
  else if (title.length < titleMin) issues.push({ route, level: 'warn', message: `title ${title.length} chars — target ${titleMin}-${titleMax}` })
  else if (title.length > titleMax) issues.push({ route, level: 'error', message: `title ${title.length} chars — over ${titleMax} cap` })

  if (!description) issues.push({ route, level: 'error', message: 'missing meta description' })
  else if (description.length < descMin) issues.push({ route, level: 'warn', message: `description ${description.length} chars — target ${descMin}-${descMax}` })
  else if (description.length > descMax) issues.push({ route, level: 'error', message: `description ${description.length} chars — over ${descMax} cap` })

  if (!canonical) issues.push({ route, level: 'warn', message: 'missing canonical link' })
  if (h1s === 0) issues.push({ route, level: 'error', message: 'no <h1> in rendered HTML' })
  if (h1s > 1) issues.push({ route, level: 'error', message: `${h1s} <h1> tags — should be exactly 1` })
  if (!ogTitle) issues.push({ route, level: 'warn', message: 'missing og:title' })
  if (!ogDesc) issues.push({ route, level: 'warn', message: 'missing og:description' })
  if (!ogImage) issues.push({ route, level: 'warn', message: 'missing og:image' })

  const blocks = extractJsonLd(html)
  const types = schemaTypes(blocks)
  const schemaIssues = validateBlocks(route, blocks, { ...DEFAULT_REQUIRED, ...config.schemaRequired })
  issues.push(...schemaIssues)

  // Gate 1 of the standard: hidden machine-only content = automatic REJECT.
  const gate = detectHiddenText(html)
  for (const v of gate) {
    issues.push({ route, level: 'error', message: `GATE: hidden machine-only content — ${v.pattern}, ${v.words} words ("${v.snippet.slice(0, 60)}…")` })
  }

  const scorecard = buildScorecard({
    html,
    route,
    origin: base.replace(/\/$/, ''),
    title,
    description,
    canonical,
    h1Count: h1s,
    faqSchemaQuestions: faqQuestionCount(blocks),
    schemaTypes: [...types],
    schemaErrorCount: schemaIssues.filter((i) => i.level === 'error').length,
    schemaIssueMessages: schemaIssues.filter((i) => i.level === 'error').map((i) => i.message),
    ogTitle,
    ogImage,
    gate,
    elapsedMs,
  })

  return {
    route,
    status,
    title,
    titleLen: title?.length ?? 0,
    description,
    descriptionLen: description?.length ?? 0,
    canonical,
    h1Count: h1s,
    h2Count: h2Count(html),
    atomicCount: atomicAnswerCount(html, config.atomicPattern),
    faqRendered: renderedFaqCount(html),
    faqSchemaQuestions: faqQuestionCount(blocks),
    ogTitle,
    ogDesc,
    ogImage,
    schemaCount: blocks.length,
    schemaTypes: [...types],
    speakable: hasSpeakable(blocks),
    elapsedMs,
    gate,
    scorecard,
    issues,
  }
}

export async function runFetchAudit(base: string, routes: string[], config: AeoScanConfig): Promise<FetchResult[]> {
  const results: FetchResult[] = []
  for (const route of routes) {
    results.push(await auditRoute(base, route, config))
  }
  return results
}
