#!/usr/bin/env node
/**
 * aeo-scan — the AEO Standard's scanner, unified CLI.
 *
 * Modes:
 *   aeo-scan <url> [<url>…]           single-URL audit(s): core checks + gate + scorecard
 *   aeo-scan                          source-parse src/app, exit 1 on tier failure
 *   aeo-scan --fetch <base>           source pre-check + rendered-HTML audit
 *   aeo-scan --fetch <base> --sitemap route discovery from <base>/sitemap.xml
 *   aeo-scan --json                   machine-readable output
 *   aeo-scan --verbose                print checks even when passing
 *   aeo-scan --md <path>              also write a Markdown report (fetch mode)
 *
 * The single-URL mode preserves the 0.0.x preview contract: the nine core
 * checks decide the exit code; the scorecard is additive information.
 * Per-site behavior comes from aeo-scan.config.json (see config.ts).
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadConfig } from './config.js'
import { runSourceScan } from './source.js'
import { auditRoute, concreteRoutes, runFetchAudit } from './fetchmode.js'
import { routesFromSitemap } from './sitemap.js'
import { coreChecks, printSourceReport, printFetchReport, printSingleUrlReport, buildMarkdownReport } from './report.js'

const HELP = `aeo-scan — score a page the way AI answer engines read it

Usage:
  npx aeo-scan <url> [<url>…]        audit URL(s): core checks, hidden-text gate,
                                     AEO Standard mechanical scorecard
  npx aeo-scan                       source-parse src/app (CI gate, exit 1 on tier failure)
  npx aeo-scan --fetch <base>        rendered-HTML audit of every discovered route
  npx aeo-scan --fetch <base> --sitemap   discover routes from <base>/sitemap.xml
  npx aeo-scan --json                machine-readable output
  npx aeo-scan --verbose             print passing checks too
  npx aeo-scan --fetch <base> --md <path> write a Markdown report

The standard: https://isimplifyme.com/labs/aeo-standard (CC BY 4.0)
A structural score is a floor, not a forecast.`

/** Positional URLs, excluding values consumed by --fetch/--md. */
export function positionalUrls(argv: string[]): string[] {
  const consumed = new Set<number>()
  for (const flag of ['--fetch', '--md']) {
    const i = argv.indexOf(flag)
    if (i >= 0) consumed.add(i + 1)
  }
  return argv.filter((a, i) => /^https?:\/\//i.test(a) && !consumed.has(i))
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP)
    return
  }
  const asJson = argv.includes('--json')
  const verbose = argv.includes('--verbose')
  const useSitemap = argv.includes('--sitemap')
  const fetchIdx = argv.indexOf('--fetch')
  const fetchBase = fetchIdx >= 0 ? argv[fetchIdx + 1] : null
  const mdIdx = argv.indexOf('--md')
  const mdPath = mdIdx >= 0 ? argv[mdIdx + 1] : null

  const cwd = process.cwd()
  const config = loadConfig(cwd)

  // --- Single-URL mode (the npx aeo-scan <url> contract) ---
  const urls = positionalUrls(argv)
  if (urls.length && !fetchBase) {
    let failed = false
    const jsonOut: unknown[] = []
    for (const raw of urls) {
      let parsed: URL
      try {
        parsed = new URL(raw)
      } catch {
        console.error(`invalid URL: ${raw}`)
        failed = true
        continue
      }
      const result = await auditRoute(parsed.origin, parsed.pathname + parsed.search, config)
      const core = coreChecks(result, config)
      if (result.gate.length || core.some((c) => !c.ok) || result.status !== 200) failed = true
      if (asJson) jsonOut.push({ url: raw, result })
      else printSingleUrlReport(raw, result, config, verbose)
    }
    if (asJson) console.log(JSON.stringify(jsonOut, null, 2))
    process.exitCode = failed ? 1 : 0
    return
  }

  if (fetchBase) {
    let routes: string[]
    let sourcePass = true
    let sourceResults: ReturnType<typeof runSourceScan> = []

    if (useSitemap) {
      routes = await routesFromSitemap(fetchBase, config.fetch.userAgent)
    } else {
      sourceResults = runSourceScan(cwd, config)
      sourcePass = sourceResults.every((r) => r.pass)
      if (!sourcePass && !asJson) {
        console.log('Source-parse pre-check failed; running fetch audit anyway:')
        for (const r of sourceResults.filter((r) => !r.pass)) {
          console.log(`  ✗ ${r.route}: missing ${r.missing.join(', ')}`)
        }
        console.log('')
      }
      routes = concreteRoutes(sourceResults.map((r) => r.route), config.substitutions)
    }

    const fetched = await runFetchAudit(fetchBase, routes, config)
    const totalErrors = fetched.reduce((s, r) => s + r.issues.filter((i) => i.level === 'error').length, 0)

    if (mdPath) {
      const md = buildMarkdownReport(fetched, fetchBase, new Date().toISOString())
      const out = resolve(cwd, mdPath)
      await mkdir(dirname(out), { recursive: true })
      await writeFile(out, md)
      if (!asJson) console.log(`[aeo-scan] wrote ${out}`)
    }

    if (asJson) {
      console.log(JSON.stringify({ source: sourceResults, fetch: fetched }, null, 2))
    } else {
      printFetchReport(fetched, fetchBase, verbose)
    }
    // exitCode (not process.exit): hard-exit truncates piped stdout >64KB.
    process.exitCode = totalErrors || !sourcePass ? 1 : 0
    return
  }

  // Source-parse only mode
  const results = runSourceScan(cwd, config)
  if (asJson) {
    console.log(JSON.stringify(results, null, 2))
  } else {
    printSourceReport(results, verbose)
  }
  process.exitCode = results.some((r) => !r.pass) ? 1 : 0
}

const isMain = (() => {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? '')).href
  } catch {
    return false
  }
})()

if (isMain) {
  main().catch((e) => {
    console.error('[aeo-scan] error:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
}
