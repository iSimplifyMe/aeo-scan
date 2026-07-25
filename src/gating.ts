/**
 * Hidden-text gating check — Gate 1 of The AEO Standard.
 *
 * Flags substantial text (> minWords) inside containers hidden from human
 * readers: screen-reader-only class families, inline clip-rect / clip-path
 * inset(50%), 1×1-pixel boxes, and large off-screen offsets. Short hidden
 * text (skip links, icon labels) is legitimate accessibility practice and is
 * deliberately NOT flagged; `display:none` is not flagged either — it powers
 * ordinary UI (menus, modals, <details>) far more often than cloaking.
 *
 * White-on-white text requires computed-style resolution and is out of scope
 * for a dependency-free scanner; the standard's gate still covers it for
 * human/LLM review.
 */

import { decodeEntities } from './html.js'

export interface GateViolation {
  /** Which hidden-text pattern matched. */
  pattern: string
  /** Word count of the hidden text. */
  words: number
  /** First 120 characters of the hidden text. */
  snippet: string
}

const HIDDEN_CLASS =
  /class=["'][^"']*\b(?<!not-)(?:sr-only|sr_only|screen-reader-only|screen-reader-text|visually-hidden|visuallyhidden|u-visually-hidden)\b[^"']*["']/i

const HIDDEN_STYLES: Array<[string, RegExp]> = [
  ['clip:rect(0,0,0,0)', /clip:\s*rect\(\s*0(?:px)?\s*,?\s*0(?:px)?\s*,?\s*0(?:px)?\s*,?\s*0(?:px)?\s*\)/i],
  ['clip-path:inset(50%)', /clip-path:\s*inset\(\s*50%\s*\)/i],
  ['1×1px box', /width:\s*1px[^"']*height:\s*1px|height:\s*1px[^"']*width:\s*1px/i],
  ['off-screen offset', /(?:left|top|text-indent):\s*-\d{4,}(?:px|em)/i],
]

/** Tags whose "content" is not reader-visible prose. */
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template', 'svg', 'head'])

function innerText(fragment: string): string {
  return decodeEntities(
    fragment
      .replace(/<(script|style|noscript|template|svg)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

export function wordCount(text: string): number {
  return text ? text.split(/\s+/).filter(Boolean).length : 0
}

/**
 * Scan rendered HTML for hidden containers wrapping substantial text.
 * Content extraction is heuristic (first matching close tag — nested
 * same-name tags undercount), which is acceptable: the gate needs to catch
 * hidden *blocks of body copy*, not resolve arbitrary DOM.
 */
export function detectHiddenText(html: string, minWords = 40): GateViolation[] {
  const out: GateViolation[] = []
  const tagRe = /<([a-z][a-z0-9]*)\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(html))) {
    const tag = m[0]
    const name = m[1].toLowerCase()
    if (SKIP_TAGS.has(name)) continue

    let pattern: string | null = null
    if (HIDDEN_CLASS.test(tag)) {
      pattern = 'screen-reader-only class'
    } else {
      const style = tag.match(/style=["']([^"']*)["']/i)?.[1]
      if (style) {
        for (const [label, re] of HIDDEN_STYLES) {
          if (re.test(style)) {
            pattern = label
            break
          }
        }
      }
    }
    if (!pattern) continue

    const close = html.indexOf(`</${name}>`, tagRe.lastIndex)
    if (close < 0) continue
    const text = innerText(html.slice(tagRe.lastIndex, close))
    const words = wordCount(text)
    if (words > minWords) {
      out.push({ pattern, words, snippet: text.slice(0, 120) })
    }
  }
  return out
}
