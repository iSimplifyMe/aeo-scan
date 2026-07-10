/** Per-@type JSON-LD structural validation (ported from eldercare aeo-check.ts v2). */

import { isObj, flattenNodes, type JsonLdBlock } from './jsonld.js'

export interface Issue {
  route: string
  level: 'error' | 'warn'
  message: string
}

/** Required fields per schema type. Extendable via config `schemaRequired`. */
export const DEFAULT_REQUIRED: Record<string, string[]> = {
  Article: ['headline', 'datePublished', 'description'],
  BlogPosting: ['headline', 'datePublished', 'description'],
  BreadcrumbList: ['itemListElement'],
  FAQPage: ['mainEntity'],
  WebPage: ['name'],
  AboutPage: ['name'],
  Organization: ['name', 'url'],
  Service: ['name', 'description'],
  DefinedTermSet: ['name'],
  CollectionPage: ['name'],
  ItemList: ['itemListElement'],
  GovernmentService: ['name', 'description'],
  HowTo: ['name', 'step'],
}

export function validateSchemaNode(
  route: string,
  obj: unknown,
  required: Record<string, string[]> = DEFAULT_REQUIRED,
): Issue[] {
  const issues: Issue[] = []
  if (!isObj(obj)) {
    issues.push({ route, level: 'error', message: 'JSON-LD node is not an object' })
    return issues
  }
  const type = obj['@type']
  if (typeof type !== 'string') {
    // @graph containers and multi-type nodes are structural, not errors.
    if (!Array.isArray(obj['@graph']) && !Array.isArray(type)) {
      issues.push({ route, level: 'error', message: 'JSON-LD node missing @type' })
    }
    return issues
  }
  for (const field of required[type] || []) {
    if (!(field in obj)) {
      issues.push({ route, level: 'error', message: `${type} missing required field: ${field}` })
    }
  }
  if (type === 'BreadcrumbList' && Array.isArray(obj['itemListElement'])) {
    obj['itemListElement'].forEach((it, i) => {
      if (!isObj(it)) {
        issues.push({ route, level: 'error', message: `BreadcrumbList[${i}] not an object` })
        return
      }
      for (const field of ['position', 'name', 'item']) {
        // The last crumb conventionally omits `item` (current page) — warn, don't error.
        if (!(field in it)) {
          const last = i === (obj['itemListElement'] as unknown[]).length - 1 && field === 'item'
          issues.push({ route, level: last ? 'warn' : 'error', message: `BreadcrumbList[${i}] missing ${field}` })
        }
      }
    })
  }
  if (type === 'FAQPage' && Array.isArray(obj['mainEntity'])) {
    obj['mainEntity'].forEach((q, i) => {
      if (!isObj(q)) {
        issues.push({ route, level: 'error', message: `FAQPage.mainEntity[${i}] not an object` })
        return
      }
      if (q['@type'] !== 'Question') issues.push({ route, level: 'warn', message: `FAQPage.mainEntity[${i}] @type should be Question` })
      if (!q['name']) issues.push({ route, level: 'error', message: `FAQPage.mainEntity[${i}] missing name` })
      const a = q['acceptedAnswer']
      if (!isObj(a)) issues.push({ route, level: 'error', message: `FAQPage.mainEntity[${i}] missing acceptedAnswer object` })
      else if (!a['text']) issues.push({ route, level: 'error', message: `FAQPage.mainEntity[${i}].acceptedAnswer missing text` })
    })
  }
  return issues
}

/** Validate every node in every parsed block (@graph-aware). */
export function validateBlocks(
  route: string,
  blocks: JsonLdBlock[],
  required?: Record<string, string[]>,
): Issue[] {
  const issues: Issue[] = []
  for (const b of blocks) {
    if (b.err) {
      issues.push({ route, level: 'error', message: `JSON-LD parse error: ${b.err.slice(0, 80)}` })
      continue
    }
    for (const node of flattenNodes(b.parsed)) {
      issues.push(...validateSchemaNode(route, node, required))
    }
  }
  return issues
}
