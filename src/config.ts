/**
 * Per-site configuration (aeo-scan.config.json at the consuming repo root).
 * Defaults reproduce the eldercare-atlas aeo-check.ts behavior so migration is
 * config-only — a site with no config gets sensible generic behavior.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export type Tier = 'strict' | 'light' | 'policy'

export interface AeoScanConfig {
  /** App-router pages root for source-parse mode. */
  appDir: string
  /** Route lists per tier; unlisted routes fall back to defaultTier. */
  tiers: Partial<Record<Tier, string[]>>
  /** Tier for routes not listed anywhere. Default 'strict' — forces explicit classification. */
  defaultTier: Tier
  /** Required check names per tier (source-parse mode). */
  requiredByTier: Record<Tier, string[]>
  /** Dynamic-segment substitutions for fetch mode, e.g. {"[stateSlug]": "california"}. */
  substitutions: Record<string, string>
  /** Extra/override source-parse checks: name -> regex source tested against page.tsx text. */
  sourceChecks: Record<string, string>
  /** Fetch-mode thresholds. */
  fetch: {
    titleMin: number
    titleMax: number
    descMin: number
    descMax: number
    userAgent: string
    /** Append a cache-busting query param to every fetched URL (defeats CDN-stale HTML). Default true. */
    cacheBust: boolean
  }
  /** Extra required-field rules per schema @type (merged over defaults). */
  schemaRequired: Record<string, string[]>
  /** Extra atomic-answer detection pattern (regex source), e.g. a site-specific module class. */
  atomicPattern?: string
}

export const DEFAULT_SOURCE_CHECKS: Record<string, string> = {
  h1: '<ContentHero\\b|<h1\\b',
  title: '\\btitle:\\s*[\'"`]|generateMetadata\\b',
  description: '\\bdescription:\\s*[\'"`]|generateMetadata\\b',
  AtomicAnswer: '<AtomicAnswer\\b',
  FAQAccordion: '<FAQAccordion\\b',
  FAQSchema: '<FAQSchema\\b',
  BreadcrumbSchema: '<BreadcrumbSchema\\b',
  PageSchema:
    '<(?:Article|Collection|Organization|Service|GovernmentService|HowTo|ItemList|DefinedTerm|WebPage|AboutPage)Schema\\b',
}

export const DEFAULT_CONFIG: AeoScanConfig = {
  appDir: 'src/app',
  tiers: {},
  defaultTier: 'strict',
  requiredByTier: {
    strict: ['h1', 'title', 'description', 'AtomicAnswer', 'FAQAccordion', 'FAQSchema', 'BreadcrumbSchema', 'PageSchema'],
    light: ['h1', 'title', 'description', 'BreadcrumbSchema', 'PageSchema'],
    policy: ['h1', 'title', 'description', 'BreadcrumbSchema'],
  },
  substitutions: {},
  sourceChecks: DEFAULT_SOURCE_CHECKS,
  fetch: {
    titleMin: 38,
    titleMax: 60,
    descMin: 120,
    descMax: 160,
    userAgent: 'iSM-AEO-scanner/3.0 (@isimplifyme/aeo-scan)',
    cacheBust: true,
  },
  schemaRequired: {},
}

export function loadConfig(cwd: string = process.cwd()): AeoScanConfig {
  const path = join(cwd, 'aeo-scan.config.json')
  if (!existsSync(path)) return DEFAULT_CONFIG
  const user = JSON.parse(readFileSync(path, 'utf8')) as Partial<AeoScanConfig>
  return {
    ...DEFAULT_CONFIG,
    ...user,
    requiredByTier: { ...DEFAULT_CONFIG.requiredByTier, ...(user.requiredByTier || {}) },
    sourceChecks: { ...DEFAULT_SOURCE_CHECKS, ...(user.sourceChecks || {}) },
    fetch: { ...DEFAULT_CONFIG.fetch, ...(user.fetch || {}) },
    schemaRequired: { ...(user.schemaRequired || {}) },
  }
}

export function classifyRoute(route: string, config: AeoScanConfig): Tier {
  for (const tier of ['strict', 'light', 'policy'] as Tier[]) {
    if (config.tiers[tier]?.includes(route)) return tier
  }
  return config.defaultTier
}
