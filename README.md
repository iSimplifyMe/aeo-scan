# @isimplifyme/aeo-scan

Audit pages the way AI answer engines read them — the iSimplifyMe AEO scanner, scoring the mechanical checks of [The AEO Standard](https://github.com/iSimplifyMe/aeo-standard).

Zero runtime dependencies. Node ≥ 20. MIT.

Two modes, one package:

- **Source-parse mode** — walks a Next.js App Router tree (`src/app` by default) and checks each `page.tsx` for the structural elements the standard requires — metadata title and description, atomic answer blocks, FAQ, breadcrumb, and page-type schema — with three-tier route classification (`strict` / `light` / `policy`) and CI exit codes.
- **Fetch mode** — audits rendered HTML per route: title and description length bands, canonical, OG tags, exactly-one H1, atomic-answer and FAQ counts, JSON-LD parsing with per-`@type` required-field validation (deep `BreadcrumbList` and `FAQPage` checks), and Speakable detection. `@graph`-aware — types inside `{"@graph":[...]}` containers are seen, the bug class that makes whole sites read as schema-free to naive scanners.

**A structural score is a floor, not a forecast.** This tool scores the mechanical half of the standard: structure makes content extractable; substance makes it citable, and substance cannot be measured by regex. No score guarantees citation by any answer engine — a tool or consultant promising otherwise is selling certainty that does not exist.

## Try it

The quickest taste is the single-URL preview on npm — no install:

```bash
npx aeo-scan https://example.com/some-page
```

The preview package ([`aeo-scan` on npm](https://www.npmjs.com/package/aeo-scan)) is maintained from [`public-preview/`](public-preview/) in this repository. A [free web scanner](https://isimplifyme.com/tools/aeo-scanner) runs the same checks in the browser.

## Full CLI

Currently published to GitHub Packages as `@isimplifyme/aeo-scan` (scoped registry, auth required); or clone this repository and run it directly:

```bash
git clone https://github.com/iSimplifyMe/aeo-scan.git
cd aeo-scan && npm install && npm run build && npm link
```

```bash
npx aeo-scan                                   # source-parse src/app, exit 1 on tier failure (CI gate)
npx aeo-scan --json                            # machine-readable
npx aeo-scan --verbose                         # print checks even when passing
npx aeo-scan --fetch http://localhost:3000     # + rendered-HTML audit (title/desc bands, schema validation)
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

The default source-parse checks look for the component conventions iSimplifyMe sites use (`<AtomicAnswer>`, `<FAQSchema>`, …). They are regex patterns in config, not hardcoded — override `sourceChecks` to match your own components, or use fetch mode, which is convention-free.

## The AEO Standard

The rubric this tool scores against is published and versioned:

- The standard (CC BY 4.0): [github.com/iSimplifyMe/aeo-standard](https://github.com/iSimplifyMe/aeo-standard) · canonical home [isimplifyme.com/labs/aeo-standard](https://isimplifyme.com/labs/aeo-standard)
- White-paper edition: [isimplifyme.com/whitepapers/the-aeo-standard](https://isimplifyme.com/whitepapers/the-aeo-standard)

The standard marks each check **mechanical** (software-scoreable — this tool) or **judgment** (human/LLM — substance and originality). This CLI deliberately scores only the mechanical subset.

## Development

```bash
npm install
npm test          # vitest
npm run build     # tsc → dist/
```

## Scope and maintenance

The core stays small and dependency-free; site-specific customization belongs in `aeo-scan.config.json`, not in the core. Issues are reviewed on a monthly cadence — reports of false positives or false negatives in specific checks are especially welcome, with the page HTML (or a reduction) attached.

## License

MIT © iSimplifyMe

---

Maintained by [iSimplifyMe](https://isimplifyme.com) — AI orchestration infrastructure and answer-engine optimization. Commercial support and full-rubric audits: [isimplifyme.com/services/aeo-infrastructure](https://isimplifyme.com/services/aeo-infrastructure).
