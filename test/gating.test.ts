import { describe, it, expect } from 'vitest'
import { detectHiddenText } from '../src/gating.js'

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

describe('detectHiddenText', () => {
  it('flags sr-only blocks of body copy (>40 words)', () => {
    const html = `<div class="sr-only">${words(50)}</div>`
    const v = detectHiddenText(html)
    expect(v).toHaveLength(1)
    expect(v[0].pattern).toBe('screen-reader-only class')
    expect(v[0].words).toBe(50)
  })

  it('does NOT flag short sr-only content (skip links, labels)', () => {
    const html = `<a class="sr-only" href="#main">Skip to main content</a><span class="visually-hidden">menu</span>`
    expect(detectHiddenText(html)).toHaveLength(0)
  })

  it('flags clip:rect(0,0,0,0) containers', () => {
    const html = `<div style="position:absolute;clip:rect(0, 0, 0, 0)">${words(45)}</div>`
    const v = detectHiddenText(html)
    expect(v).toHaveLength(1)
    expect(v[0].pattern).toBe('clip:rect(0,0,0,0)')
  })

  it('flags clip-path:inset(50%) containers', () => {
    const html = `<span style="clip-path: inset(50%)">${words(41)}</span>`
    expect(detectHiddenText(html)).toHaveLength(1)
  })

  it('flags 1×1-pixel boxes', () => {
    const html = `<div style="width:1px;height:1px;overflow:hidden">${words(60)}</div>`
    const v = detectHiddenText(html)
    expect(v).toHaveLength(1)
    expect(v[0].pattern).toBe('1×1px box')
  })

  it('flags large off-screen offsets', () => {
    const html = `<div style="text-indent:-9999px">${words(42)}</div>`
    expect(detectHiddenText(html)).toHaveLength(1)
  })

  it('does NOT flag display:none (ordinary UI) or aria-hidden', () => {
    const html =
      `<div style="display:none">${words(80)}</div>` +
      `<div aria-hidden="true">${words(80)}</div>`
    expect(detectHiddenText(html)).toHaveLength(0)
  })

  it('does NOT flag visible content', () => {
    const html = `<article><p>${words(200)}</p></article>`
    expect(detectHiddenText(html)).toHaveLength(0)
  })

  it('ignores hidden script/style tags', () => {
    const html = `<style class="sr-only">.x{color:red}</style><script class="sr-only">var x = "${words(50)}"</script>`
    expect(detectHiddenText(html)).toHaveLength(0)
  })
})
