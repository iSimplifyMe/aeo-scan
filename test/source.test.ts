import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runSourceScan } from '../src/source.js'
import { DEFAULT_CONFIG, classifyRoute, type AeoScanConfig } from '../src/config.js'

const GOOD_PAGE = `
export const metadata = { title: 'x', description: 'y' }
export default function Page() {
  return (<main><ContentHero /><AtomicAnswer q="q" /><FAQAccordion items={[]} />
    <FAQSchema /><BreadcrumbSchema /><ArticleSchema /></main>)
}
`
const POLICY_PAGE = `
export const metadata = { title: 'privacy', description: 'p' }
export default function Page() { return (<main><h1>Privacy</h1><BreadcrumbSchema /></main>) }
`

function makeApp(): { cwd: string; config: AeoScanConfig } {
  const cwd = mkdtempSync(join(tmpdir(), 'aeo-scan-test-'))
  mkdirSync(join(cwd, 'src/app/privacy'), { recursive: true })
  writeFileSync(join(cwd, 'src/app/page.tsx'), GOOD_PAGE)
  writeFileSync(join(cwd, 'src/app/privacy/page.tsx'), POLICY_PAGE)
  const config: AeoScanConfig = {
    ...DEFAULT_CONFIG,
    tiers: { strict: ['/'], policy: ['/privacy'] },
  }
  return { cwd, config }
}

describe('source-parse mode', () => {
  it('discovers routes and scores tiers (parity with legacy aeo-check.ts)', () => {
    const { cwd, config } = makeApp()
    const results = runSourceScan(cwd, config)
    expect(results.map((r) => r.route)).toEqual(['/', '/privacy'])

    const home = results.find((r) => r.route === '/')!
    expect(home.tier).toBe('strict')
    expect(home.pass).toBe(true)
    expect(home.score).toBe(100)

    const privacy = results.find((r) => r.route === '/privacy')!
    expect(privacy.tier).toBe('policy')
    expect(privacy.pass).toBe(true)
  })

  it('fails a strict page missing components', () => {
    const { cwd, config } = makeApp()
    writeFileSync(join(cwd, 'src/app/page.tsx'), POLICY_PAGE) // strip components from strict route
    const results = runSourceScan(cwd, config)
    const home = results.find((r) => r.route === '/')!
    expect(home.pass).toBe(false)
    expect(home.missing).toContain('AtomicAnswer')
  })

  it('unknown routes default to strict (forces explicit classification)', () => {
    expect(classifyRoute('/brand-new', DEFAULT_CONFIG)).toBe('strict')
  })
})
