import { describe, it, expect } from 'vitest'
import { validateSchemaNode, validateBlocks } from '../src/schema.js'
import { extractJsonLd } from '../src/jsonld.js'

const R = '/x'

describe('validateSchemaNode', () => {
  it('passes a complete Article', () => {
    const issues = validateSchemaNode(R, { '@type': 'Article', headline: 'h', datePublished: 'd', description: 'x' })
    expect(issues).toHaveLength(0)
  })

  it('flags missing Article fields', () => {
    const issues = validateSchemaNode(R, { '@type': 'Article', headline: 'h' })
    const msgs = issues.map((i) => i.message)
    expect(msgs).toContain('Article missing required field: datePublished')
    expect(msgs).toContain('Article missing required field: description')
  })

  it('does not error on @graph containers without @type', () => {
    const issues = validateSchemaNode(R, { '@context': 'https://schema.org', '@graph': [] })
    expect(issues).toHaveLength(0)
  })

  it('validates BreadcrumbList items; last crumb may omit item (warn only)', () => {
    const issues = validateSchemaNode(R, {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://x/' },
        { '@type': 'ListItem', position: 2, name: 'Here' },
      ],
    })
    expect(issues.filter((i) => i.level === 'error')).toHaveLength(0)
    expect(issues.filter((i) => i.level === 'warn')).toHaveLength(1)
  })

  it('flags FAQPage question without acceptedAnswer text', () => {
    const issues = validateSchemaNode(R, {
      '@type': 'FAQPage',
      mainEntity: [{ '@type': 'Question', name: 'q', acceptedAnswer: {} }],
    })
    expect(issues.some((i) => i.message.includes('acceptedAnswer missing text'))).toBe(true)
  })
})

describe('validateBlocks', () => {
  it('reports JSON parse errors as issues', () => {
    const blocks = extractJsonLd('<script type="application/ld+json">{bad</script>')
    const issues = validateBlocks(R, blocks)
    expect(issues.some((i) => i.message.startsWith('JSON-LD parse error'))).toBe(true)
  })

  it('validates nodes inside @graph', () => {
    const blocks = extractJsonLd(
      '<script type="application/ld+json">{"@graph":[{"@type":"Article","headline":"h"}]}</script>',
    )
    const issues = validateBlocks(R, blocks)
    expect(issues.some((i) => i.message.includes('Article missing required field'))).toBe(true)
  })
})
