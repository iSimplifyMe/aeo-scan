#!/usr/bin/env node
/**
 * Assemble dist-npmjs/ — the public npmjs `aeo-scan` package (the full CLI).
 *
 * The repo's root package stays `@isimplifyme/aeo-scan` on GitHub Packages for
 * internal site-repo consumers; this script stages the same built dist/ under
 * the public npmjs name. Publish flow:
 *
 *   npm run build && npm run stage:npmjs && cd dist-npmjs && npm publish --access public
 *
 * Gotcha encoded here: npm strips `./`-prefixed bin paths at publish
 * ("invalid and removed" → a silently binary-less package). Bin values must
 * be bare relative paths.
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const NPMJS_VERSION = '0.1.0'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const out = join(root, 'dist-npmjs')

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
cpSync(join(root, 'dist'), join(out, 'dist'), { recursive: true })
cpSync(join(root, 'README.md'), join(out, 'README.md'))
cpSync(join(root, 'LICENSE'), join(out, 'LICENSE'))

const pkg = {
  name: 'aeo-scan',
  version: NPMJS_VERSION,
  description:
    "Score any page the way AI answer engines read it — the AEO Standard's open-source scanner: single-URL audits with a mechanical scorecard, hidden-text gating, source-parse + sitemap modes, JSON-LD validation, CI exit codes.",
  type: 'module',
  bin: { 'aeo-scan': 'dist/cli.js' },
  main: 'dist/index.js',
  types: 'dist/index.d.ts',
  engines: { node: '>=20' },
  keywords: [
    'aeo',
    'answer-engine-optimization',
    'seo',
    'ai-search',
    'schema',
    'json-ld',
    'chatgpt',
    'perplexity',
    'llm',
    'cli',
  ],
  author: 'iSimplifyMe (https://isimplifyme.com)',
  homepage: 'https://isimplifyme.com/tools/aeo-scanner',
  repository: { type: 'git', url: 'git+https://github.com/iSimplifyMe/aeo-scan.git' },
  license: 'MIT',
}

writeFileSync(join(out, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
console.log(`staged aeo-scan@${NPMJS_VERSION} in dist-npmjs/`)
