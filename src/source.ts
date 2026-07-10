/** Source-parse mode: walk an app-router tree and check page.tsx files for AEO elements. */

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { classifyRoute, type AeoScanConfig, type Tier } from './config.js'

export interface PageResult {
  route: string
  file: string
  tier: Tier
  present: string[]
  missing: string[]
  score: number // 0..100 relative to tier requirements
  pass: boolean
}

export function findPages(dir: string, base = dir, out: { route: string; file: string }[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) findPages(full, base, out)
    else if (entry.name === 'page.tsx') {
      const rel = relative(base, full).replace(/\/?page\.tsx$/, '')
      out.push({ route: rel === '' ? '/' : '/' + rel, file: full })
    }
  }
  return out
}

export function scorePage(file: string, route: string, config: AeoScanConfig): PageResult {
  const src = readFileSync(file, 'utf8')
  const tier = classifyRoute(route, config)
  const required = config.requiredByTier[tier]
  const present = Object.entries(config.sourceChecks)
    .filter(([, pattern]) => new RegExp(pattern).test(src))
    .map(([name]) => name)
  const missing = required.filter((r) => !present.includes(r))
  const score = Math.round((required.filter((r) => present.includes(r)).length / required.length) * 100)
  return { route, file, tier, present, missing, score, pass: missing.length === 0 }
}

export function runSourceScan(cwd: string, config: AeoScanConfig): PageResult[] {
  const appDir = join(cwd, config.appDir)
  return findPages(appDir)
    .sort((a, b) => a.route.localeCompare(b.route))
    .map((p) => scorePage(p.file, p.route, config))
}
