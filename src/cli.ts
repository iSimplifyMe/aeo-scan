#!/usr/bin/env node
/**
 * @isimplifyme/aeo-scan — unified CLI.
 *
 * Modes (mirroring the legacy per-repo scripts so migration is drop-in):
 *   aeo-scan                          source-parse src/app, exit 1 on tier failure
 *   aeo-scan --fetch <base>           source pre-check + rendered-HTML audit
 *   aeo-scan --fetch <base> --sitemap route discovery from <base>/sitemap.xml
 *   aeo-scan --json                   machine-readable output
 *   aeo-scan --verbose                print checks even when passing
 *   aeo-scan --md <path>              also write a Markdown report (fetch mode)
 *
 * Per-site behavior comes from aeo-scan.config.json (see config.ts).
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { loadConfig } from './config.js'
import { runSourceScan } from './source.js'
import { concreteRoutes, runFetchAudit } from './fetchmode.js'
import { routesFromSitemap } from './sitemap.js'
import { printSourceReport, printFetchReport, buildMarkdownReport } from './report.js'

async function main() {
  const argv = process.argv.slice(2)
  const asJson = argv.includes('--json')
  const verbose = argv.includes('--verbose')
  const useSitemap = argv.includes('--sitemap')
  const fetchIdx = argv.indexOf('--fetch')
  const fetchBase = fetchIdx >= 0 ? argv[fetchIdx + 1] : null
  const mdIdx = argv.indexOf('--md')
  const mdPath = mdIdx >= 0 ? argv[mdIdx + 1] : null

  const cwd = process.cwd()
  const config = loadConfig(cwd)

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
    process.exit(totalErrors || !sourcePass ? 1 : 0)
  }

  // Source-parse only mode
  const results = runSourceScan(cwd, config)
  if (asJson) {
    console.log(JSON.stringify(results, null, 2))
  } else {
    printSourceReport(results, verbose)
  }
  process.exit(results.some((r) => !r.pass) ? 1 : 0)
}

main().catch((e) => {
  console.error('[aeo-scan] error:', e instanceof Error ? e.message : e)
  process.exit(1)
})
