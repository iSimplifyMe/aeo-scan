import { describe, it, expect } from 'vitest'
import {
  decodeEntities,
  extractTitle,
  extractMeta,
  extractCanonical,
  h1Count,
  atomicAnswerCount,
  renderedFaqCount,
} from '../src/html.js'

describe('html extraction', () => {
  it('extracts and entity-decodes the title', () => {
    expect(extractTitle('<title>Cats &amp; Dogs</title>')).toBe('Cats & Dogs')
  })

  it('extracts meta by name or property, either attribute order', () => {
    expect(extractMeta('<meta name="description" content="hi">', 'description')).toBe('hi')
    expect(extractMeta('<meta content="og!" property="og:title">', 'og:title')).toBe('og!')
  })

  it('extracts canonical href', () => {
    expect(extractCanonical('<link rel="canonical" href="https://x/y">')).toBe('https://x/y')
    expect(extractCanonical('<link href="https://x/y" rel="canonical">')).toBe('https://x/y')
  })

  it('counts h1s', () => {
    expect(h1Count('<h1>a</h1><h1 class="x">b</h1>')).toBe(2)
    expect(h1Count('<h2>no</h2>')).toBe(0)
  })

  it('counts atomic-answer blocks by class, data attribute, and extra pattern', () => {
    const html = '<div class="atomic-answer">x</div><p data-atomic-answer>y</p><i class="AtomicAnswer-module_a">z</i>'
    expect(atomicAnswerCount(html)).toBe(2)
    expect(atomicAnswerCount(html, 'AtomicAnswer-module')).toBe(3)
  })

  it('counts rendered FAQ questions via details fallback', () => {
    expect(renderedFaqCount('<details><summary>1</summary></details><details></details><details></details>')).toBe(3)
  })

  it('decodes numeric entities', () => {
    expect(decodeEntities('a&#39;b&#x27;c')).toBe("a'b'c")
  })
})
