/** Console, JSON, and Markdown reporters (console format preserved from the legacy scripts). */

import type { PageResult } from './source.js'
import type { FetchResult } from './fetchmode.js'

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

export function printFetchReport(results: FetchResult[], base: string, verbose: boolean): void {
  const totalIssues = results.reduce((s, r) => s + r.issues.length, 0)
  const totalErrors = results.reduce((s, r) => s + r.issues.filter((i) => i.level === 'error').length, 0)

  console.log(`AEO fetch audit — ${results.length} routes against ${base}`)
  console.log('='.repeat(78))
  for (const r of results) {
    const errs = r.issues.filter((i) => i.level === 'error').length
    const warns = r.issues.filter((i) => i.level === 'warn').length
    const mark = errs ? '✗' : warns ? '⚠' : '✓'
    console.log(
      `${mark} ${r.route.padEnd(52)} t=${String(r.titleLen).padStart(3)} d=${String(r.descriptionLen).padStart(3)} schemas=${r.schemaCount} errs=${errs} warns=${warns}`,
    )
    if ((errs || verbose) && r.issues.length) {
      for (const issue of r.issues) {
        console.log(`    ${issue.level === 'error' ? '✗' : '⚠'} ${issue.message}`)
      }
    }
  }
  console.log('='.repeat(78))
  console.log(`${results.length} routes checked — ${totalErrors} errors, ${totalIssues - totalErrors} warnings`)
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
  lines.push('| Page | Status | Title | Desc | H1 | Atomic | FAQ | Schemas | Errors |')
  lines.push('|---|---|---|---|---|---|---|---|---|')
  for (const r of results) {
    const errs = r.issues.filter((i) => i.level === 'error')
    const mark = errs.length === 0 ? '✅' : '❌'
    const schemas = r.schemaTypes.length ? r.schemaTypes.join(', ') : '—'
    const errStr = errs.length ? errs.map((e) => e.message).join('; ') : '—'
    lines.push(
      `| \`${r.route}\` | ${mark} | ${r.titleLen}c | ${r.descriptionLen}c | ${r.h1Count} | ${r.atomicCount} | ${r.faqSchemaQuestions} | ${schemas} | ${errStr} |`,
    )
  }
  lines.push('')
  return lines.join('\n')
}
