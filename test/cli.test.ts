import { describe, it, expect } from 'vitest'
import { positionalUrls } from '../src/cli.js'

describe('positionalUrls', () => {
  it('collects bare URLs', () => {
    expect(positionalUrls(['https://a.com/x', 'http://b.com'])).toEqual(['https://a.com/x', 'http://b.com'])
  })

  it('ignores flags and non-URL positionals', () => {
    expect(positionalUrls(['--json', '--verbose', 'notaurl'])).toEqual([])
  })

  it('excludes the --fetch and --md values', () => {
    expect(positionalUrls(['--fetch', 'https://base.com', 'https://real.com/page'])).toEqual(['https://real.com/page'])
    expect(positionalUrls(['--md', 'https://weird-path.com', 'https://real.com'])).toEqual(['https://real.com'])
  })
})
