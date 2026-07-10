import { describe, it, expect } from 'vitest'
import { extractJsonLd, flattenNodes, schemaTypes, faqQuestionCount, hasSpeakable } from '../src/jsonld.js'

const wrap = (json: string) => `<html><head><script type="application/ld+json">${json}</script></head></html>`

describe('extractJsonLd', () => {
  it('extracts and parses a block', () => {
    const blocks = extractJsonLd(wrap('{"@type":"Article","headline":"x"}'))
    expect(blocks).toHaveLength(1)
    expect(blocks[0].err).toBeUndefined()
  })

  it('reports parse errors instead of throwing', () => {
    const blocks = extractJsonLd(wrap('{not json'))
    expect(blocks).toHaveLength(1)
    expect(blocks[0].err).toBeTruthy()
  })

  it('finds multiple blocks', () => {
    const html = wrap('{"@type":"Article"}') + wrap('{"@type":"FAQPage","mainEntity":[]}')
    expect(extractJsonLd(html)).toHaveLength(2)
  })
})

describe('@graph handling (regression: isimplifyme.com homepage, 2026-07-10)', () => {
  const graph = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', name: 'iSM', url: 'https://x.com' },
      { '@type': 'WebSite', name: 'iSM' },
      {
        '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: 'q1', acceptedAnswer: { '@type': 'Answer', text: 'a1' } },
          { '@type': 'Question', name: 'q2', acceptedAnswer: { '@type': 'Answer', text: 'a2' } },
          { '@type': 'Question', name: 'q3', acceptedAnswer: { '@type': 'Answer', text: 'a3' } },
        ],
      },
    ],
  })

  it('flattenNodes descends into @graph', () => {
    const nodes = flattenNodes(JSON.parse(graph))
    // container + 3 graph nodes
    expect(nodes).toHaveLength(4)
  })

  it('schemaTypes sees types inside @graph', () => {
    const types = schemaTypes(extractJsonLd(wrap(graph)))
    expect(types.has('Organization')).toBe(true)
    expect(types.has('WebSite')).toBe(true)
    expect(types.has('FAQPage')).toBe(true)
  })

  it('faqQuestionCount counts questions inside @graph', () => {
    expect(faqQuestionCount(extractJsonLd(wrap(graph)))).toBe(3)
  })
})

describe('shape coverage', () => {
  it('handles top-level arrays', () => {
    const types = schemaTypes(extractJsonLd(wrap('[{"@type":"Article"},{"@type":"WebPage","name":"x"}]')))
    expect(types.has('Article')).toBe(true)
    expect(types.has('WebPage')).toBe(true)
  })

  it('handles multi-@type arrays on one node', () => {
    const types = schemaTypes(extractJsonLd(wrap('{"@type":["Organization","LocalBusiness"],"name":"x","url":"y"}')))
    expect(types.has('LocalBusiness')).toBe(true)
  })

  it('detects speakable', () => {
    expect(hasSpeakable(extractJsonLd(wrap('{"@type":"WebPage","name":"x","speakable":{"@type":"SpeakableSpecification"}}')))).toBe(true)
    expect(hasSpeakable(extractJsonLd(wrap('{"@type":"WebPage","name":"x"}')))).toBe(false)
  })
})
