/** Console, JSON, and Markdown reporters (console format preserved from the legacy scripts). */

import type { PageResult } from './source.js'
import type { FetchResult } from './fetchmode.js'
import type { AeoScanConfig } from './config.js'
import type { Scorecard } from './score.js'

export function printSourceReport(results: PageResult[], verbose: boolean): void {
  const passed = results.filter((r) => r.pass).length
  const meanScore = results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0

  console.log(`AEO audit — ${results.length} routes scanned`)
  console.log('='.repeat(78))
  for (const r of results) {
    const mark = r.pass ? '✓' : '✗'
    const tierBadge = r.tier === 'strict' ? '        ' : ` [${r.tier}] `.padEnd(8)
    const pad = (r.route + tierBadge).padEnd(46)
    const missingStr = r.missing.length ? ` — missing: ${r.missing.join(', ')}` : ''
    const scoreStr = String(r.score).padStart(3) + '/100'
    if (r.pass && !verbose) console.log(`${mark} ${pad} ${scoreStr}`)
    else console.log(`${mark} ${pad} ${scoreStr}${missingStr}`)
  }
  console.log('='.repeat(78))
  console.log(`${passed}/${results.length} routes passing their tier`)
  console.log(`Mean page score: ${meanScore}/100`)
}

export interface CoreCheck {
  label: string
  ok: boolean
  note: string
}

/** The single-URL preview contract: the nine core checks, unchanged since 0.0.1. */
export function coreChecks(r: FetchResult, config: AeoScanConfig): CoreCheck[] {
  const { titleMin, titleMax, descMin, descMax } = config.fetch
  const band = (len: number, min: number, max: number): { ok: boolean; note: string } => {
    if (len === 0) return { ok: false, note: 'missing' }
    if (len < min) return { ok: false, note: `${len} chars — under ${min}-${max} band` }
    if (len > max) return { ok: false, note: `${len} chars — over ${min}-${max} band` }
    return { ok: true, note: `${len} chars` }
  }
  const t = band(r.titleLen, titleMin, titleMax)
  const d = band(r.descriptionLen, descMin, descMax)
  return [
    { label: 'title', ok: t.ok, note: t.note },
    { label: 'meta description', ok: d.ok, note: d.note },
    { label: 'canonical', ok: !!r.canonical, note: r.canonical ? 'present' : 'missing' },
    { label: 'h1', ok: r.h1Count === 1, note: r.h1Count === 1 ? 'exactly 1' : `${r.h1Count} found — should be exactly 1` },
    { label: 'og:title', ok: !!r.ogTitle, note: r.ogTitle ? 'present' : 'missing' },
    { label: 'og:image', ok: !!r.ogImage, note: r.ogImage ? 'present' : 'missing' },
    { label: 'schema (JSON-LD)', ok: r.schemaTypes.length > 0, note: r.schemaTypes.length ? r.schemaTypes.join(', ') : 'none' },
    { label: 'BreadcrumbList', ok: r.schemaTypes.includes('BreadcrumbList'), note: r.schemaTypes.includes('BreadcrumbList') ? 'present' : 'missing — most commonly missed schema' },
    { label: 'FAQPage ≥3 Q&A', ok: r.faqSchemaQuestions >= 3, note: `${r.faqSchemaQuestions} questions` },
  ]
}

const FLOOR_NOTE = [
  '  Note: mechanical checks score structure only. Structure makes content',
  '  extractable; substance makes it citable. A score is a floor, not a forecast.',
  '  The AEO Standard: https://isimplifyme.com/labs/aeo-standard',
]

export function printScorecard(sc: Scorecard, verbose: boolean): void {
  if (sc.gate.length) {
    console.log('')
    console.log('  ✖ GATE — hidden machine-only content: AUTOMATIC REJECT (overrides any score)')
    for (const v of sc.gate) {
      console.log(`      ${v.pattern} — ${v.words} hidden words: "${v.snippet.slice(0, 70)}…"`)
    }
  }
  console.log('')
  console.log(`  AEO Standard v${sc.standardVersion} — mechanical scorecard`)
  for (const s of sc.sections) {
    const unscored: string[] = []
    if (s.judgmentMax) unscored.push(`${s.judgmentMax} judgment`)
    if (s.siteScopeMax) unscored.push(`${s.siteScopeMax} site-scope`)
    const tail = unscored.length ? `  (+${unscored.join(' + ')} pts unscored)` : ''
    const mech = s.mechMax ? `${String(s.mechEarned).padStart(2)}/${s.mechMax} [M]` : '   —    '
    console.log(`  S${s.id} ${s.name.padEnd(28)} ${mech}${tail}`)
    for (const c of s.checks) {
      const failed = c.kind === 'M' && c.earned === 0
      if (failed || (verbose && c.kind === 'M')) {
        console.log(`      ${failed ? '✗' : '✓'} ${c.label} — ${c.note}`)
      }
    }
  }
  console.log(`  ${'—'.repeat(60)}`)
  console.log(`  Mechanical floor: ${sc.mechEarned}/${sc.mechMax} · unscored by software: ${sc.judgmentMax} judgment + ${sc.siteScopeMax} site-scope pts`)
  if (sc.verdict === 'REJECT') {
    console.log('  Verdict: REJECT (gating violation)')
  } else {
    console.log('  Verdict: none — a total verdict requires the judgment sections (see standard)')
  }
}

export function printSingleUrlReport(url: string, r: FetchResult, config: AeoScanConfig, verbose: boolean): void {
  console.log(`\naeo-scan — ${url}\n`)
  let pass = 0
  const checks = coreChecks(r, config)
  for (const c of checks) {
    if (c.ok) pass++
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.label.padEnd(20)} ${c.note}`)
  }
  console.log(`\n  ${pass}/${checks.length} core checks passing`)
  if (r.scorecard) printScorecard(r.scorecard, verbose)
  console.log('')
  for (const line of FLOOR_NOTE) console.log(line)
  console.log('')
}

export function printFetchReport(results: FetchResult[], base: string, verbose: boolean): void {
  const totalIssues = results.reduce((s, r) => s + r.issues.length, 0)
  const totalErrors = results.reduce((s, r) => s + r.issues.filter((i) => i.level === 'error').length, 0)

  console.log(`AEO fetch audit — ${results.length} routes against ${base}`)
  console.log('='.repeat(78))
  for (const r of results) {
    const errs = r.issues.filter((i) => i.level === 'error').length
    const warns = r.issues.filter((i) => i.level === 'warn').length
    const gate = r.gate.length ? ' GATE!' : ''
    const mech = r.scorecard ? ` m=${String(r.scorecard.mechEarned).padStart(2)}/${r.scorecard.mechMax}` : ''
    const mark = errs ? '✗' : warns ? '⚠' : '✓'
    console.log(
      `${mark} ${r.route.padEnd(46)} t=${String(r.titleLen).padStart(3)} d=${String(r.descriptionLen).padStart(3)} schemas=${r.schemaCount}${mech} errs=${errs} warns=${warns}${gate}`,
    )
    if ((errs || verbose) && r.issues.length) {
      for (const issue of r.issues) {
        console.log(`    ${issue.level === 'error' ? '✗' : '⚠'} ${issue.message}`)
      }
    }
  }
  console.log('='.repeat(78))
  console.log(`${results.length} routes checked — ${totalErrors} errors, ${totalIssues - totalErrors} warnings`)
  for (const line of FLOOR_NOTE) console.log(line)
}

/** Markdown report (subdial aeo-audit.mjs style) — for docs/AEO-AUDIT-<date>.md artifacts. */
export function buildMarkdownReport(results: FetchResult[], base: string, dateIso: string): string {
  const total = results.length || 1
  const errCount = (r: FetchResult) => r.issues.filter((i) => i.level === 'error').length
  const clean = results.filter((r) => errCount(r) === 0).length
  const fail = results.filter((r) => errCount(r) > 0).length

  const schemaCounts: Record<string, number> = {}
  for (const r of results) for (const s of r.schemaTypes) schemaCounts[s] = (schemaCounts[s] || 0) + 1
  const speakable = results.filter((r) => r.speakable).length

  const lines: string[] = []
  lines.push(`# AEO Audit — ${dateIso.slice(0, 10)}`)
  lines.push('')
  lines.push(`**Source:** ${base}`)
  lines.push(`**Pages audited:** ${results.length}`)
  lines.push(`**Generated:** ${dateIso}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push('| Status | Count | % |')
  lines.push('|---|---|---|')
  lines.push(`| ✅ Clean (0 errors) | ${clean} | ${((clean / total) * 100).toFixed(0)}% |`)
  lines.push(`| ❌ Has errors | ${fail} | ${((fail / total) * 100).toFixed(0)}% |`)
  lines.push('')
  lines.push('## Schema coverage')
  lines.push('')
  lines.push('| Schema | Pages | % |')
  lines.push('|---|---|---|')
  for (const [k, n] of Object.entries(schemaCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`| \`${k}\` | ${n} | ${((n / total) * 100).toFixed(0)}% |`)
  }
  lines.push(`| Speakable | ${speakable} | ${((speakable / total) * 100).toFixed(0)}% |`)
  lines.push('')
  lines.push('## Per-page checklist')
  lines.push('')
  lines.push('| Page | Status | Mech | Title | Desc | H1 | Atomic | FAQ | Schemas | Errors |')
  lines.push('|---|---|---|---|---|---|---|---|---|---|')
  for (const r of results) {
    const errs = r.issues.filter((i) => i.level === 'error')
    const mark = errs.length === 0 ? '✅' : '❌'
    const mech = r.scorecard ? `${r.scorecard.mechEarned}/${r.scorecard.mechMax}` : '—'
    const schemas = r.schemaTypes.length ? r.schemaTypes.join(', ') : '—'
    const errStr = errs.length ? errs.map((e) => e.message).join('; ') : '—'
    lines.push(
      `| \`${r.route}\` | ${mark} | ${mech} | ${r.titleLen}c | ${r.descriptionLen}c | ${r.h1Count} | ${r.atomicCount} | ${r.faqSchemaQuestions} | ${schemas} | ${errStr} |`,
    )
  }
  lines.push('')
  return lines.join('\n')
}
