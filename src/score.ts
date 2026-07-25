/**
 * Scorecard — maps a fetched page onto The AEO Standard v1.0.
 *
 * Source of truth: METHODOLOGY.md in iSimplifyMe/aeo-standard. Every check
 * there is marked [M] (mechanical) or [J] (judgment); this module scores the
 * mechanical checks ONLY and reports judgment checks as unscored. It never
 * produces a PUBLISH/REVISE/REWRITE verdict — those require the judgment
 * sections — but a gating violation is a full REJECT regardless of points.
 *
 * Mechanical ceiling in single-URL scope: 55 of 100 points
 * (S2 12 · S3 10 · S4 9 · S5 8 · S6 6 · S7 10). Two further S6 points are
 * mechanical but need site context (orphan check) and are reported as such.
 */

import {
  atomicBlocks,
  anchorLinks,
  bodyWordCount,
  extractMeta,
  headingNestingClean,
  headingSequence,
  imageAltStats,
  paragraphTexts,
  questionHeadingCount,
  sentenceCount,
  tocAnchorLinkCount,
  type AtomicBlock,
} from './html.js'
import type { GateViolation } from './gating.js'

export type CheckKind = 'M' | 'M-site' | 'J'

export interface CheckResult {
  id: string
  label: string
  kind: CheckKind
  max: number
  /** Points earned; null when the check is not scoreable in this run (J or M-site). */
  earned: number | null
  note: string
}

export interface SectionScore {
  id: number
  name: string
  mechEarned: number
  mechMax: number
  judgmentMax: number
  siteScopeMax: number
  checks: CheckResult[]
}

export interface Scorecard {
  standardVersion: string
  sections: SectionScore[]
  mechEarned: number
  mechMax: number
  judgmentMax: number
  siteScopeMax: number
  gate: GateViolation[]
  /** 'REJECT' on any gating violation; otherwise null — no total verdict without judgment sections. */
  verdict: 'REJECT' | null
}

export interface ScoreInput {
  html: string
  route: string
  origin?: string
  title: string | null
  description: string | null
  canonical: string | null
  h1Count: number
  faqSchemaQuestions: number
  schemaTypes: string[]
  schemaErrorCount: number
  schemaIssueMessages: string[]
  ogTitle: string | null
  ogImage: string | null
  gate: GateViolation[]
  elapsedMs: number
}

const ARTICLE_FAMILY = new Set(['Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'ScholarlyArticle'])
const NON_PAGETYPE = new Set([
  ...ARTICLE_FAMILY,
  'FAQPage',
  'BreadcrumbList',
  'WebSite',
  'ImageObject',
  'ListItem',
  'Question',
  'Answer',
  'SearchAction',
  'EntryPoint',
  '(unparseable block)',
])
const GENERIC_ANCHORS = /^(click here|read more|learn more|here|more|link)$/i
const SELF_REFERENCE = /as (?:mentioned|discussed|noted) (?:above|earlier)|see (?:above|below)/i

function check(
  id: string,
  label: string,
  kind: CheckKind,
  max: number,
  earned: number | null,
  note: string,
): CheckResult {
  return { id, label, kind, max, earned, note }
}

function judgment(id: string, label: string, max: number): CheckResult {
  return check(id, label, 'J', max, null, 'judgment — human or LLM review')
}

function section(id: number, name: string, checks: CheckResult[]): SectionScore {
  const mech = checks.filter((c) => c.kind === 'M')
  return {
    id,
    name,
    mechEarned: mech.reduce((s, c) => s + (c.earned ?? 0), 0),
    mechMax: mech.reduce((s, c) => s + c.max, 0),
    judgmentMax: checks.filter((c) => c.kind === 'J').reduce((s, c) => s + c.max, 0),
    siteScopeMax: checks.filter((c) => c.kind === 'M-site').reduce((s, c) => s + c.max, 0),
    checks,
  }
}

function scoreAtomic(blocks: AtomicBlock[], gateReject: boolean): CheckResult[] {
  const out: CheckResult[] = []

  if (blocks.length === 0) {
    out.push(check('s2.visible', 'Blocks visible on the page', 'M', 3, 0, 'no atomic-answer blocks found (class="atomic-answer" or data-atomic-answer)'))
  } else if (gateReject) {
    out.push(check('s2.visible', 'Blocks visible on the page', 'M', 3, 0, 'hidden-text gate fired — visibility cannot be credited'))
  } else {
    out.push(check('s2.visible', 'Blocks visible on the page', 'M', 3, 3, `${blocks.length} visible block(s)`))
  }

  const offBand = blocks.filter((b) => b.words < 40 || b.words > 60)
  const selfRef = blocks.filter((b) => SELF_REFERENCE.test(b.text))
  if (blocks.length === 0) {
    out.push(check('s2.band', '40–60 words, self-contained', 'M', 3, 0, 'no blocks to measure'))
  } else if (offBand.length || selfRef.length) {
    const notes: string[] = []
    if (offBand.length) notes.push(`out of band: ${offBand.map((b) => `${b.words}w`).join(', ')}`)
    if (selfRef.length) notes.push(`${selfRef.length} block(s) reference other parts of the page`)
    out.push(check('s2.band', '40–60 words, self-contained', 'M', 3, 0, notes.join('; ')))
  } else {
    out.push(check('s2.band', '40–60 words, self-contained', 'M', 3, 3, `all ${blocks.length} in band`))
  }

  const noQuestion = blocks.filter((b) => !b.question)
  if (blocks.length === 0) {
    out.push(check('s2.first40', 'Primary question answered at the top of its section', 'M', 3, 0, 'no blocks to measure'))
  } else if (noQuestion.length) {
    out.push(check('s2.first40', 'Primary question answered at the top of its section', 'M', 3, 0, `${noQuestion.length} block(s) lack a preceding question-phrased heading`))
  } else {
    out.push(check('s2.first40', 'Primary question answered at the top of its section', 'M', 3, 3, 'every block sits under a question heading'))
  }

  const questions = blocks.map((b) => b.question).filter((q): q is string => q !== null)
  const distinct = new Set(questions.map((q) => q.toLowerCase())).size === questions.length
  if (blocks.length >= 3 && distinct) {
    out.push(check('s2.count', '3–5+ blocks, distinct questions', 'M', 3, 3, `${blocks.length} blocks, distinct intents`))
  } else if (blocks.length < 3) {
    out.push(check('s2.count', '3–5+ blocks, distinct questions', 'M', 3, 0, `${blocks.length} block(s) — minimum is 3`))
  } else {
    out.push(check('s2.count', '3–5+ blocks, distinct questions', 'M', 3, 0, 'duplicate question intents'))
  }

  out.push(judgment('s2.definitive', 'Definitive language', 3))
  return out
}

export function buildScorecard(input: ScoreInput): Scorecard {
  const { html, route } = input
  const gateReject = input.gate.length > 0

  const blocks = atomicBlocks(html)
  const headings = headingSequence(html)
  const paras = paragraphTexts(html)
  const links = anchorLinks(html)
  const words = bodyWordCount(html)
  const imgs = imageAltStats(html)

  const internal = links.filter(
    (a) =>
      (a.href.startsWith('/') && !a.href.startsWith('//')) ||
      (input.origin ? a.href.startsWith(input.origin) : false),
  )
  const toPath = (href: string): string => {
    if (input.origin && href.startsWith(input.origin)) return href.slice(input.origin.length) || '/'
    return href
  }

  // --- Section 1 — all judgment ---
  const s1 = section(1, 'Substance & Originality', [
    judgment('s1.claim', 'Claim/take not in the generic top-10', 5),
    judgment('s1.firsthand', 'First-hand experience or proprietary data', 5),
    judgment('s1.specific', 'Specific entities, numbers, examples', 5),
    judgment('s1.notgeneric', 'Not reproducible by a one-line prompt', 5),
    judgment('s1.expertise', 'Demonstrable expertise', 5),
  ])

  // --- Section 2 — atomic answer blocks ---
  const s2 = section(2, 'Atomic Answer Blocks', scoreAtomic(blocks, gateReject))

  // --- Section 3 — structured data ---
  const s3checks: CheckResult[] = []
  s3checks.push(
    input.faqSchemaQuestions >= 3
      ? check('s3.faq', 'FAQPage with 3+ Q&A', 'M', 2, 2, `${input.faqSchemaQuestions} questions`)
      : check('s3.faq', 'FAQPage with 3+ Q&A', 'M', 2, 0, `${input.faqSchemaQuestions} questions — need 3+`),
  )
  // schemaIssueMessages carries ERROR-level messages only (warnings, like the
  // conventional last-breadcrumb `item` omission, must not zero a check).
  const articlePresent = input.schemaTypes.some((t) => ARTICLE_FAMILY.has(t))
  const articleBroken = input.schemaIssueMessages.some((m) => /(?:Article|BlogPosting)\b.*missing/.test(m))
  s3checks.push(
    articlePresent && !articleBroken
      ? check('s3.article', 'Article/BlogPosting with required fields', 'M', 2, 2, 'present, fields complete')
      : check('s3.article', 'Article/BlogPosting with required fields', 'M', 2, 0, articlePresent ? 'present but missing required fields' : 'no Article-family schema'),
  )
  const crumbPresent = input.schemaTypes.includes('BreadcrumbList')
  const crumbBroken = input.schemaIssueMessages.some((m) => /BreadcrumbList/.test(m))
  s3checks.push(
    crumbPresent && !crumbBroken
      ? check('s3.breadcrumb', 'BreadcrumbList', 'M', 2, 2, 'present')
      : check('s3.breadcrumb', 'BreadcrumbList', 'M', 2, 0, crumbPresent ? 'present but structurally incomplete' : 'missing — the most commonly missed schema'),
  )
  // "Where applicable": an Article-family node IS the page's type — an
  // article page is not additionally required to carry HowTo/Person/etc.
  const pageType = input.schemaTypes.filter((t) => !NON_PAGETYPE.has(t))
  s3checks.push(
    pageType.length || articlePresent
      ? check('s3.pagetype', 'Page-type schema where applicable', 'M', 2, 2, pageType.length ? pageType.join(', ') : 'article-family node is the page type')
      : check('s3.pagetype', 'Page-type schema where applicable', 'M', 2, 0, 'no page-type node (HowTo/Person/Organization/Service/Article/…)'),
  )
  s3checks.push(
    input.schemaTypes.length > 0 && input.schemaErrorCount === 0
      ? check('s3.valid', 'Schema validates with zero errors', 'M', 2, 2, 'clean')
      : check('s3.valid', 'Schema validates with zero errors', 'M', 2, 0, input.schemaTypes.length ? `${input.schemaErrorCount} error(s)` : 'no JSON-LD found'),
  )
  const s3 = section(3, 'Structured Data & Schema', s3checks)

  // --- Section 4 — RAG readiness ---
  const s4checks: CheckResult[] = []
  s4checks.push(judgment('s4.frontload', 'Key facts front-loaded', 3))
  const longParas = paras.filter((p) => sentenceCount(p) > 4)
  s4checks.push(
    paras.length && longParas.length / paras.length <= 0.2
      ? check('s4.paragraphs', 'Short paragraphs (2–4 sentences)', 'M', 3, 3, `${paras.length - longParas.length}/${paras.length} within bound`)
      : check('s4.paragraphs', 'Short paragraphs (2–4 sentences)', 'M', 3, 0, paras.length ? `${longParas.length}/${paras.length} paragraphs run over 4 sentences` : 'no <p> paragraphs found'),
  )
  s4checks.push(
    headings.filter((h) => h.level >= 2).length >= 2 && !gateReject
      ? check('s4.boundaries', 'Real structural boundaries, no fake blocks', 'M', 3, 3, 'headed sections, no hidden blocks')
      : check('s4.boundaries', 'Real structural boundaries, no fake blocks', 'M', 3, 0, gateReject ? 'hidden-text gate fired' : 'fewer than 2 subheadings'),
  )
  s4checks.push(judgment('s4.entity', 'Entity consistency', 3))
  s4checks.push(judgment('s4.data', 'Data-backed claims', 3))
  const rawParas = [...html.matchAll(/<p[^>]*>[\s\S]*?<\/p>/gi)].map((m) => m[0])
  const statParas = rawParas.filter((p) => /\d+(?:\.\d+)?\s*(?:%|percent)|\b\d+(?:,\d{3})+\b|\b(?:million|billion)\b/i.test(p))
  const attributed = statParas.filter((p) => /<a\b/i.test(p) || /according to|reports?\b|study|survey|census|source:/i.test(p))
  s4checks.push(
    statParas.length === 0
      ? check('s4.attribution', 'Source attribution for statistics', 'M', 3, 3, 'no statistics detected — nothing to attribute')
      : attributed.length > 0
        ? check('s4.attribution', 'Source attribution for statistics', 'M', 3, 3, `${attributed.length}/${statParas.length} stat paragraph(s) attributed`)
        : check('s4.attribution', 'Source attribution for statistics', 'M', 3, 0, `${statParas.length} stat paragraph(s), none attributed or linked`),
  )
  s4checks.push(judgment('s4.definitive', 'Definitive statements, no ambiguous pronouns', 2))
  const s4 = section(4, 'RAG / Retrieval Readiness', s4checks)

  // --- Section 5 — semantic HTML ---
  const s5checks: CheckResult[] = []
  s5checks.push(
    input.h1Count === 1
      ? check('s5.h1', 'Single H1', 'M', 2, 2, 'exactly 1')
      : check('s5.h1', 'Single H1', 'M', 2, 0, `${input.h1Count} found`),
  )
  s5checks.push(
    headingNestingClean(headings)
      ? check('s5.nesting', 'No skipped heading levels', 'M', 2, 2, 'clean hierarchy')
      : check('s5.nesting', 'No skipped heading levels', 'M', 2, 0, 'level skip detected (e.g. h2 → h4)'),
  )
  const qCount = questionHeadingCount(headings)
  s5checks.push(
    qCount >= 2
      ? check('s5.questions', 'Question-phrased headings', 'M', 2, 2, `${qCount} question heading(s)`)
      : check('s5.questions', 'Question-phrased headings', 'M', 2, 0, `${qCount} question heading(s) — phrase headings as questions where natural`),
  )
  const toc = tocAnchorLinkCount(html)
  s5checks.push(
    toc >= 3
      ? check('s5.toc', 'Table of contents with anchor links', 'M', 2, 2, `${toc} in-page anchors`)
      : check('s5.toc', 'Table of contents with anchor links', 'M', 2, 0, `${toc} in-page anchor link(s) — need 3+`),
  )
  s5checks.push(judgment('s5.readable', 'Clear, readable structure', 2))
  const s5 = section(5, 'Semantic HTML & Headings', s5checks)

  // --- Section 6 — linking ---
  const s6checks: CheckResult[] = []
  const segments = route.split('/').filter(Boolean)
  const hubPath = segments.length ? `/${segments[0]}` : null
  const meaningful = internal.filter((a) => a.text.length >= 4 && !GENERIC_ANCHORS.test(a.text.trim()))
  const hubLinked = hubPath
    ? meaningful.some((a) => {
        const p = toPath(a.href).replace(/\/$/, '')
        return p === hubPath || p === ''
      })
    : meaningful.length > 0
  s6checks.push(
    hubLinked
      ? check('s6.hub', 'Hub/pillar link with keyword anchor', 'M', 2, 2, hubPath ? `links up to ${hubPath}` : 'keyword-anchored internal links present')
      : check('s6.hub', 'Hub/pillar link with keyword anchor', 'M', 2, 0, hubPath ? `no keyword-anchored link to ${hubPath} or /` : 'no keyword-anchored internal links'),
  )
  const needed = Math.max(3, Math.ceil(words / 1500) * 3)
  const uniqueAnchors = new Set(internal.map((a) => a.text.toLowerCase())).size
  s6checks.push(
    internal.length >= needed && uniqueAnchors >= Math.ceil(internal.length / 2)
      ? check('s6.density', '3+ internal links / 1,500 words, varied anchors', 'M', 2, 2, `${internal.length} internal links, ${uniqueAnchors} distinct anchors (${words} words)`)
      : check('s6.density', '3+ internal links / 1,500 words, varied anchors', 'M', 2, 0, `${internal.length} internal links for ${words} words (need ${needed}) — ${uniqueAnchors} distinct anchors`),
  )
  const bySection: Record<string, number> = {}
  for (const a of internal) {
    const p = toPath(a.href)
    const seg = p.split('/').filter(Boolean)[0]
    if (!seg) continue
    if (p.replace(/\/$/, '') === route.replace(/\/$/, '')) continue
    bySection[seg] = (bySection[seg] || 0) + 1
  }
  const clusterCount = segments.length
    ? bySection[segments[0]] || 0
    : Math.max(0, ...Object.values(bySection))
  s6checks.push(
    clusterCount >= 2
      ? check('s6.cluster', 'Links to related cluster content', 'M', 2, 2, `${clusterCount} same-section link(s)`)
      : check('s6.cluster', 'Links to related cluster content', 'M', 2, 0, `${clusterCount} same-section link(s) — need 2+`),
  )
  s6checks.push(judgment('s6.fanout', 'Cluster covers the query fan-out', 2))
  s6checks.push(check('s6.orphan', 'No orphan pages', 'M-site', 2, null, 'requires site context — not scored in single-URL mode'))
  const s6 = section(6, 'Internal Linking & Fan-Out', s6checks)

  // --- Section 7 — meta & technical (standard bands, not config bands) ---
  const s7checks: CheckResult[] = []
  const tLen = input.title?.length ?? 0
  s7checks.push(
    tLen >= 50 && tLen <= 60
      ? check('s7.title', 'Title 50–60 characters', 'M', 2, 2, `${tLen} chars`)
      : check('s7.title', 'Title 50–60 characters', 'M', 2, 0, input.title ? `${tLen} chars` : 'missing'),
  )
  const dLen = input.description?.length ?? 0
  s7checks.push(
    dLen >= 150 && dLen <= 160
      ? check('s7.desc', 'Description 150–160 characters', 'M', 2, 2, `${dLen} chars`)
      : check('s7.desc', 'Description 150–160 characters', 'M', 2, 0, input.description ? `${dLen} chars` : 'missing'),
  )
  const slugClean =
    !/(19|20)\d{2}(?:\/|$)/.test(route) &&
    segments.length <= 5 &&
    route.length <= 80 &&
    (segments.length === 0 || /^[a-z0-9-]+$/.test(segments[segments.length - 1]))
  s7checks.push(
    slugClean
      ? check('s7.slug', 'Clean, evergreen URL slug', 'M', 2, 2, route || '/')
      : check('s7.slug', 'Clean, evergreen URL slug', 'M', 2, 0, `${route} — dates, depth, or characters off`),
  )
  s7checks.push(
    imgs.total === 0 || imgs.missingAlt === 0
      ? check('s7.alt', 'Alt text on all images', 'M', 1, 1, imgs.total ? `${imgs.total} image(s), all with alt` : 'no images')
      : check('s7.alt', 'Alt text on all images', 'M', 1, 0, `${imgs.missingAlt}/${imgs.total} image(s) missing alt`),
  )
  const twitterCard = extractMeta(html, 'twitter:card')
  s7checks.push(
    input.ogTitle && input.ogImage
      ? check('s7.og', 'OG / Twitter card tags', 'M', 1, 1, twitterCard ? 'og + twitter:card' : 'og present (no twitter:card)')
      : check('s7.og', 'OG / Twitter card tags', 'M', 1, 0, 'og:title/og:image incomplete'),
  )
  s7checks.push(
    input.canonical
      ? check('s7.canonical', 'Canonical URL', 'M', 1, 1, 'present')
      : check('s7.canonical', 'Canonical URL', 'M', 1, 0, 'missing'),
  )
  s7checks.push(
    input.elapsedMs < 3000
      ? check('s7.load', 'Page load under 3 seconds', 'M', 1, 1, `${input.elapsedMs}ms document fetch (not full page load)`)
      : check('s7.load', 'Page load under 3 seconds', 'M', 1, 0, `${input.elapsedMs}ms document fetch`),
  )
  const s7 = section(7, 'SEO Meta & Technical', s7checks)

  const sections = [s1, s2, s3, s4, s5, s6, s7]
  return {
    standardVersion: '1.0',
    sections,
    mechEarned: sections.reduce((s, x) => s + x.mechEarned, 0),
    mechMax: sections.reduce((s, x) => s + x.mechMax, 0),
    judgmentMax: sections.reduce((s, x) => s + x.judgmentMax, 0),
    siteScopeMax: sections.reduce((s, x) => s + x.siteScopeMax, 0),
    gate: input.gate,
    verdict: gateReject ? 'REJECT' : null,
  }
}
