import { describe, it, expect } from 'vitest'
import {
  headingSequence,
  questionHeadingCount,
  headingNestingClean,
  paragraphTexts,
  sentenceCount,
  anchorLinks,
  tocAnchorLinkCount,
  imageAltStats,
  atomicBlocks,
  bodyWordCount,
} from '../src/html.js'

describe('headingSequence + nesting + questions', () => {
  const html = `<h1>Main Title</h1><h2>What is X?</h2><p>a</p><h2>Plain Section</h2><h3>How does Y work?</h3>`
  it('extracts headings in order with levels', () => {
    const h = headingSequence(html)
    expect(h.map((x) => x.level)).toEqual([1, 2, 2, 3])
    expect(h[1].text).toBe('What is X?')
  })
  it('counts question headings (h2–h4)', () => {
    expect(questionHeadingCount(headingSequence(html))).toBe(2)
  })
  it('accepts clean nesting and rejects skips', () => {
    expect(headingNestingClean(headingSequence(html))).toBe(true)
    expect(headingNestingClean(headingSequence('<h2>a</h2><h4>b</h4>'))).toBe(false)
  })
})

describe('paragraphs + sentences', () => {
  it('extracts paragraph text and counts sentences', () => {
    const paras = paragraphTexts('<p>One. Two. Three.</p><p><strong>Bold</strong> only</p><p></p>')
    expect(paras).toHaveLength(2)
    expect(sentenceCount(paras[0])).toBe(3)
    expect(sentenceCount(paras[1])).toBe(1)
  })
})

describe('links + toc + images', () => {
  const html =
    `<nav><a href="#one">One</a><a href="#two">Two</a><a href="#three">Three</a></nav>` +
    `<a href="/blog">the blog hub</a><a href="https://ext.example">ext</a>` +
    `<img src="a.png" alt="described"><img src="b.png" alt=""><img src="c.png">`
  it('extracts anchors with text', () => {
    const links = anchorLinks(html)
    expect(links.find((l) => l.href === '/blog')?.text).toBe('the blog hub')
  })
  it('counts in-page anchors as ToC signal', () => {
    expect(tocAnchorLinkCount(html)).toBe(3)
  })
  it('counts only images with NO alt attribute — explicit alt="" is decorative, not missing', () => {
    expect(imageAltStats(html)).toEqual({ total: 3, missingAlt: 1 })
  })
})

describe('atomicBlocks', () => {
  const answer = Array.from({ length: 45 }, (_, i) => `w${i}`).join(' ')
  const html =
    `<h2>What is the thing?</h2><div class="atomic-answer"><p>${answer}</p></div>` +
    `<h2>Not a question</h2><div class="atomic-answer"><p>${answer}</p></div>`
  it('pairs blocks with preceding question headings and counts words', () => {
    const blocks = atomicBlocks(html)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].question).toBe('What is the thing?')
    expect(blocks[0].words).toBe(45)
    expect(blocks[1].question).toBeNull()
  })
})

describe('bodyWordCount', () => {
  it('counts visible words, ignoring scripts', () => {
    const html = `<body><p>one two three</p><script>var x = "not counted words here at all"</script></body>`
    expect(bodyWordCount(html)).toBe(3)
  })
})
