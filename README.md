# aeo-scan

Audit pages the way AI answer engines read them — the open-source scanner for [The AEO Standard](https://github.com/iSimplifyMe/aeo-standard), scoring its mechanical checks with the standard's own point values.

Zero runtime dependencies. Node ≥ 20. MIT.

```bash
npx aeo-scan https://example.com/some-page
```

That single command runs the nine core checks (title and description bands, canonical, exactly-one H1, OG tags, JSON-LD schema types, BreadcrumbList, FAQ depth), the **hidden-text gate**, and the **AEO Standard mechanical scorecard** — and exits nonzero when a core check fails, so it drops straight into CI.

## What it scores — and deliberately does not

The AEO Standard marks every check **[M]** mechanical or **[J]** judgment. This scanner scores the mechanical checks only — 55 of 100 points in single-URL scope — and reports the judgment sections (all 25 points of Substance & Originality among them) as *unscored*, because whether a page says anything worth citing cannot be measured by regex. It never claims a PUBLISH or REJECT verdict from structure alone, with one exception:

**The gate.** Text hidden from human readers but served to crawlers — screen-reader-only blocks of body copy, `clip:rect(0,0,0,0)` or 1×1-pixel containers, large off-screen offsets — wrapping more than 40 words is an automatic **REJECT**, overriding any score, exactly as the standard specifies. Short hidden text (skip links, icon labels) is normal accessibility practice and is not flagged; neither is `display:none`.

**A structural score is a floor, not a forecast.** No score guarantees citation by any answer engine — a tool or consultant promising otherwise is selling certainty that does not exist.

## Modes

```bash
npx aeo-scan <url> [<url>…]                  # single-URL audit(s): core checks + gate + scorecard
npx aeo-scan                                 # source-parse src/app, exit 1 on tier failure (CI gate)
npx aeo-scan --fetch http://localhost:3000   # rendered-HTML audit of every discovered route
npx aeo-scan --fetch https://site.com --sitemap          # discover routes from sitemap.xml
npx aeo-scan --fetch https://site.com --sitemap --md docs/AEO-AUDIT.md   # + Markdown report
npx aeo-scan --json                          # machine-readable output (all modes)
npx aeo-scan --verbose                       # print passing checks too
```

Source-parse mode walks a Next.js App Router tree and checks each `page.tsx` for the structural elements the standard requires, with three-tier route classification (`strict` / `light` / `policy`). Fetch mode audits rendered HTML per route — JSON-LD parsing is `@graph`-aware, the bug class that makes whole sites read as schema-free to naive scanners.

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

The default source-parse checks look for the component conventions iSimplifyMe sites use (`<AtomicAnswer>`, `<FAQSchema>`, …) — regex patterns in config, not hardcoded. The core-check bands are configurable; the scorecard's section points always follow the standard as published.

## Install

The npm package **is** this CLI (from 0.1.0):

```bash
npm install -g aeo-scan     # or npx aeo-scan, no install
```

Internal iSimplifyMe repos consume the same code as `@isimplifyme/aeo-scan` from GitHub Packages; the npmjs package is staged from the identical built `dist/` via `npm run stage:npmjs`.

## The AEO Standard

- The standard (CC BY 4.0): [github.com/iSimplifyMe/aeo-standard](https://github.com/iSimplifyMe/aeo-standard) · canonical home [isimplifyme.com/labs/aeo-standard](https://isimplifyme.com/labs/aeo-standard)
- White-paper edition: [isimplifyme.com/whitepapers/the-aeo-standard](https://isimplifyme.com/whitepapers/the-aeo-standard)
- [Free web scanner](https://isimplifyme.com/tools/aeo-scanner) — the same checks in the browser

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
