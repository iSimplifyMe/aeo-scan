#!/usr/bin/env node
// aeo-scan — early preview (v0.0.1)
// Checks one URL for the core AEO signals AI answer engines read.
// The full CLI (100-point AEO Standard scoring, sitemap crawls, CI gates,
// LLM substance scoring) is in development: https://isimplifyme.com/tools/aeo-scanner

const url = process.argv[2]

if (!url || url === '--help' || url === '-h') {
  console.log(`aeo-scan (preview) — score a page the way AI answer engines read it

Usage:
  npx aeo-scan <url>

Checks (preview): title + length band, meta description + length band,
canonical, H1 count, OG tags, JSON-LD schema types (FAQPage, BreadcrumbList,
Article, ...), FAQ Q&A count.

The full AEO Standard (100-point rubric) and CLI are in development by
iSimplifyMe. Web version today: https://isimplifyme.com/tools/aeo-scanner`)
  process.exit(url ? 0 : 1)
}

const TITLE = [38, 60]
const DESC = [120, 160]

function band(len, [min, max], label) {
  if (len === 0) return { ok: false, note: `missing` }
  if (len < min) return { ok: false, note: `${len} chars — under ${min}-${max} band` }
  if (len > max) return { ok: false, note: `${len} chars — over ${min}-${max} band` }
  return { ok: true, note: `${len} chars` }
}

function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
}

function meta(html, name) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, 'i')
  const tag = html.match(re)
  if (!tag) return null
  const c = tag[0].match(/content=["']([^"']*)["']/i)
  return c ? decode(c[1]).trim() : null
}

const res = await fetch(url, { headers: { 'User-Agent': 'aeo-scan/0.0.1' } }).catch((e) => {
  console.error(`fetch failed: ${e.message}`)
  process.exit(1)
})
if (!res.ok) {
  console.error(`HTTP ${res.status} — ${url}`)
  process.exit(1)
}
const html = await res.text()

const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() ?? ''
const desc = meta(html, 'description') ?? ''
const canonical = /<link[^>]+rel=["']canonical["']/i.test(html)
const h1Count = (html.match(/<h1[\s>]/gi) || []).length
const ogTitle = !!meta(html, 'og:title')
const ogImage = !!meta(html, 'og:image')

const types = new Set()
let faqQuestions = 0
// Flatten top-level arrays AND @graph containers — both are common JSON-LD shapes.
function nodes(data) {
  const top = Array.isArray(data) ? data : [data]
  return top.flatMap((n) => (n && Array.isArray(n['@graph']) ? [n, ...n['@graph']] : [n]))
}
for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
  try {
    for (const node of nodes(JSON.parse(m[1]))) {
      const t = node?.['@type']
      if (typeof t === 'string') types.add(t)
      else if (Array.isArray(t)) t.forEach((x) => types.add(x))
      if (t === 'FAQPage' && Array.isArray(node.mainEntity)) faqQuestions += node.mainEntity.length
    }
  } catch { /* malformed JSON-LD is itself a finding */ types.add('(unparseable block)') }
}

const rows = [
  ['title', band(title.length, TITLE, 'title')],
  ['meta description', band(desc.length, DESC, 'description')],
  ['canonical', { ok: canonical, note: canonical ? 'present' : 'missing' }],
  ['h1', { ok: h1Count === 1, note: h1Count === 1 ? 'exactly 1' : `${h1Count} found — should be exactly 1` }],
  ['og:title', { ok: ogTitle, note: ogTitle ? 'present' : 'missing' }],
  ['og:image', { ok: ogImage, note: ogImage ? 'present' : 'missing' }],
  ['schema (JSON-LD)', { ok: types.size > 0, note: types.size ? [...types].join(', ') : 'none' }],
  ['BreadcrumbList', { ok: types.has('BreadcrumbList'), note: types.has('BreadcrumbList') ? 'present' : 'missing — most commonly missed schema' }],
  ['FAQPage ≥3 Q&A', { ok: faqQuestions >= 3, note: `${faqQuestions} questions` }],
]

console.log(`\naeo-scan preview — ${url}\n`)
let pass = 0
for (const [label, r] of rows) {
  if (r.ok) pass++
  console.log(`  ${r.ok ? '✓' : '✗'} ${label.padEnd(20)} ${r.note}`)
}
console.log(`\n  ${pass}/${rows.length} preview checks passing`)
console.log(`  Note: this preview scores structure only. Structure makes content`)
console.log(`  extractable; substance makes it citable. The score is a floor, not a forecast.`)
console.log(`  Full 100-point AEO Standard: https://isimplifyme.com/tools/aeo-scanner\n`)
process.exit(pass === rows.length ? 0 : 1)
