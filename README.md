# @isimplifyme/aeo-scan

**Internal.** The unified iSM AEO scanner — one package replacing the per-repo
copies of `aeo-check.ts` (eldercare-atlas, roofing-tech-pro, afterloss-atlas),
`aeo-scan.mjs` (getvesper-site), and `aeo-audit.mjs` (subdial).

Zero runtime dependencies. Node ≥ 20.

## Install (GitHub Packages)

Repo needs an `.npmrc` with:

```
@isimplifyme:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```bash
npm i -D @isimplifyme/aeo-scan
```

## Usage

```bash
npx aeo-scan                                   # source-parse src/app, exit 1 on tier failure (CI gate)
npx aeo-scan --json                            # machine-readable
npx aeo-scan --verbose                         # print checks even when passing
npx aeo-scan --fetch http://localhost:3344     # + rendered-HTML audit (title/desc bands, schema validation)
npx aeo-scan --fetch https://site.com --sitemap    # discover routes from sitemap.xml instead of src/app
npx aeo-scan --fetch https://site.com --sitemap --md docs/AEO-AUDIT.md   # + Markdown report artifact
```

## Per-site config — `aeo-scan.config.json`

Everything site-specific lives here; no config = generic defaults.

```jsonc
{
  "appDir": "src/app",
  "tiers": {
    "strict": ["/", "/answers", "/[stateSlug]"],
    "light": ["/about/ai", "/methodology"],
    "policy": ["/privacy", "/terms"]
  },
  "defaultTier": "strict",                     // unknown routes fail loud
  "substitutions": { "[stateSlug]": "california" },
  "sourceChecks": { "AtomicAnswer": "<AtomicAnswer\\b" },  // override/extend component regexes
  "fetch": { "titleMin": 38, "titleMax": 60, "descMin": 120, "descMax": 160 },
  "atomicPattern": "AtomicAnswer-module"       // extra rendered-DOM atomic detection
}
```

## What it checks

- **Source-parse mode:** page.tsx per route — H1/ContentHero, metadata title +
  description, AtomicAnswer, FAQAccordion, FAQSchema, BreadcrumbSchema,
  page-type schema; 3-tier requirements (strict / light / policy).
- **Fetch mode:** rendered `<title>`/description length bands, canonical, OG
  tags, exactly-one H1, atomic-answer + FAQ counts, JSON-LD parse +
  per-@type required-field validation (deep BreadcrumbList/FAQPage checks),
  Speakable detection. **@graph-aware** — the legacy scripts missed types
  inside `{"@graph":[...]}` containers entirely.

## Development

```bash
npm install
npm test          # vitest
npm run build     # tsc → dist/
npm publish       # runs test+build via prepublishOnly; needs write:packages token
```

`public-preview/` holds the standalone `aeo-scan` npmjs placeholder package
(the public name claim) — separate from this internal package. See
`~/claude/projects/iSM-aeo/oss-aeo-scanner-scope-2026-07-10.md` for the
tiered open-source plan this fits into.
