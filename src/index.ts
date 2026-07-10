export { loadConfig, classifyRoute, DEFAULT_CONFIG, DEFAULT_SOURCE_CHECKS } from './config.js'
export type { AeoScanConfig, Tier } from './config.js'
export { findPages, scorePage, runSourceScan } from './source.js'
export type { PageResult } from './source.js'
export { auditRoute, runFetchAudit, concreteRoutes } from './fetchmode.js'
export type { FetchResult } from './fetchmode.js'
export { parseSitemap, routesFromSitemap } from './sitemap.js'
export { extractJsonLd, flattenNodes, schemaTypes, faqQuestionCount, hasSpeakable, isObj } from './jsonld.js'
export type { JsonLdBlock } from './jsonld.js'
export { validateSchemaNode, validateBlocks, DEFAULT_REQUIRED } from './schema.js'
export type { Issue } from './schema.js'
export {
  decodeEntities,
  extractTitle,
  extractMeta,
  extractCanonical,
  h1Count,
  h2Count,
  atomicAnswerCount,
  renderedFaqCount,
} from './html.js'
export { printSourceReport, printFetchReport, buildMarkdownReport } from './report.js'
