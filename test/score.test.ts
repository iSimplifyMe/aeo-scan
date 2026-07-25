import { describe, it, expect } from 'vitest'
import { buildScorecard, type ScoreInput } from '../src/score.js'

const answer = (seed: string) => Array.from({ length: 45 }, (_, i) => `${seed}${i}`).join(' ')

/** A page engineered to earn every single-URL mechanical point. */
function goodPageHtml(): string {
  return `<!doctype html><html><head><title>${'t'.repeat(55)}</title></head><body>
<nav><a href="#s1">Section one</a> <a href="#s2">Section two</a> <a href="#s3">Section three</a></nav>
<h1>The Main Topic</h1>
<p>Intro paragraph. Short and clean.</p>
<h2 id="s1">What is alpha?</h2>
<div class="atomic-answer"><p>${answer('a')}</p></div>
<p>Body text. Two sentences here.</p>
<h2 id="s2">What is beta?</h2>
<div class="atomic-answer"><p>${answer('b')}</p></div>
<h2 id="s3">What is gamma?</h2>
<div class="atomic-answer"><p>${answer('c')}</p></div>
<p>More prose with an internal reference to <a href="/blog">the blog hub</a>.</p>
<p>Related reading: <a href="/blog/other-post">deeper coverage of alpha</a> and <a href="/blog/another-post">the beta field guide</a>.</p>
<img src="x.png" alt="a described image">
</body></html>`
}

function goodInput(): ScoreInput {
  return {
    html: goodPageHtml(),
    route: '/blog/test-post',
    origin: 'https://example.com',
    title: 't'.repeat(55),
    description: 'd'.repeat(155),
    canonical: 'https://example.com/blog/test-post',
    h1Count: 1,
    faqSchemaQuestions: 4,
    schemaTypes: ['BlogPosting', 'FAQPage', 'BreadcrumbList', 'Organization'],
    schemaErrorCount: 0,
    schemaIssueMessages: [],
    ogTitle: 'og',
    ogImage: 'https://example.com/og.png',
    gate: [],
    elapsedMs: 120,
  }
}

describe('buildScorecard — structure', () => {
  it('sections sum to the standard: 55 mech + 43 judgment + 2 site-scope = 100', () => {
    const sc = buildScorecard(goodInput())
    expect(sc.mechMax).toBe(55)
    expect(sc.judgmentMax).toBe(43)
    expect(sc.siteScopeMax).toBe(2)
    const allChecksMax = sc.sections.flatMap((s) => s.checks).reduce((sum, c) => sum + c.max, 0)
    expect(allChecksMax).toBe(100)
  })
})

describe('buildScorecard — a fully clean page', () => {
  it('earns the full mechanical ceiling', () => {
    const sc = buildScorecard(goodInput())
    const failing = sc.sections
      .flatMap((s) => s.checks)
      .filter((c) => c.kind === 'M' && c.earned === 0)
      .map((c) => `${c.id}: ${c.note}`)
    expect(failing).toEqual([])
    expect(sc.mechEarned).toBe(55)
    expect(sc.verdict).toBeNull()
  })
})

describe('buildScorecard — gate', () => {
  it('gating violation forces REJECT and zeroes atomic visibility', () => {
    const input = goodInput()
    input.gate = [{ pattern: 'screen-reader-only class', words: 80, snippet: 'hidden words' }]
    const sc = buildScorecard(input)
    expect(sc.verdict).toBe('REJECT')
    const visible = sc.sections[1].checks.find((c) => c.id === 's2.visible')
    expect(visible?.earned).toBe(0)
  })
})

describe('buildScorecard — degraded pages', () => {
  it('scores zero atomic points when no blocks exist', () => {
    const input = goodInput()
    input.html = '<html><body><h1>Just A Page</h1><p>One paragraph.</p></body></html>'
    const sc = buildScorecard(input)
    expect(sc.sections[1].mechEarned).toBe(0)
  })

  it('fails the band check on out-of-band blocks', () => {
    const input = goodInput()
    const short = Array.from({ length: 20 }, (_, i) => `s${i}`).join(' ')
    input.html = `<h2>What is short?</h2><div class="atomic-answer"><p>${short}</p></div>`
    const sc = buildScorecard(input)
    const band = sc.sections[1].checks.find((c) => c.id === 's2.band')
    expect(band?.earned).toBe(0)
    expect(band?.note).toContain('20w')
  })

  it('fails schema checks without types and article when fields missing', () => {
    const input = goodInput()
    input.schemaTypes = ['BlogPosting']
    input.schemaErrorCount = 1
    input.schemaIssueMessages = ['BlogPosting missing required field: datePublished']
    const sc = buildScorecard(input)
    const byId = Object.fromEntries(sc.sections[2].checks.map((c) => [c.id, c]))
    expect(byId['s3.article'].earned).toBe(0)
    expect(byId['s3.breadcrumb'].earned).toBe(0)
    expect(byId['s3.valid'].earned).toBe(0)
  })

  it('flags unattributed statistics', () => {
    const input = goodInput()
    input.html = goodPageHtml().replace(
      '<p>Body text. Two sentences here.</p>',
      '<p>Adoption grew 45% last year across 12,000 companies.</p>',
    )
    const sc = buildScorecard(input)
    const attr = sc.sections[3].checks.find((c) => c.id === 's4.attribution')
    expect(attr?.earned).toBe(0)
  })

  it('accepts attributed statistics', () => {
    const input = goodInput()
    input.html = goodPageHtml().replace(
      '<p>Body text. Two sentences here.</p>',
      '<p>According to the annual survey, adoption grew 45% last year.</p>',
    )
    const sc = buildScorecard(input)
    const attr = sc.sections[3].checks.find((c) => c.id === 's4.attribution')
    expect(attr?.earned).toBe(3)
  })

  it('credits page-type via an article-family node alone', () => {
    const input = goodInput()
    input.schemaTypes = ['BlogPosting', 'FAQPage', 'BreadcrumbList']
    const sc = buildScorecard(input)
    const pt = sc.sections[2].checks.find((c) => c.id === 's3.pagetype')
    expect(pt?.earned).toBe(2)
    expect(pt?.note).toContain('article-family')
  })

  it('marks the orphan check as site-scope, never earned or failed', () => {
    const sc = buildScorecard(goodInput())
    const orphan = sc.sections[5].checks.find((c) => c.id === 's6.orphan')
    expect(orphan?.kind).toBe('M-site')
    expect(orphan?.earned).toBeNull()
  })
})
