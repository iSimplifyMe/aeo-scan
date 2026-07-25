# Changelog

## aeo-scan 0.1.0 (npmjs) · @isimplifyme/aeo-scan 0.2.0 — 2026-07-25

The npm package graduates from a single-file preview to the full CLI. The
preview contract is preserved: `npx aeo-scan <url>` still runs the nine core
checks and they alone decide the exit code.

- **Positional single-URL mode** — `aeo-scan <url> [<url>…]`: core checks,
  gate, and scorecard per URL; `--json` supported.
- **Hidden-text gating check** (Gate 1 of the standard) — screen-reader-only
  class families, `clip:rect(0,0,0,0)`, `clip-path:inset(50%)`, 1×1-pixel
  boxes, and large off-screen offsets wrapping more than 40 words of text.
  Any violation is an automatic REJECT. Short hidden text (skip links,
  labels) and `display:none` are deliberately not flagged.
- **AEO Standard v1.0 mechanical scorecard** — every [M] check from
  METHODOLOGY.md, by section, with the standard's point values: 55 of 100
  points are software-scorable in single-URL scope; judgment checks (43 pts)
  and the site-scope orphan check (2 pts) are reported as unscored, never
  guessed. No PUBLISH/REVISE verdict is ever claimed from structure alone.
- Fetch mode reports a per-route mechanical score; the Markdown report gains
  a Mech column.
- Schema validation covers TechArticle and NewsArticle required fields.
- Images with an explicit `alt=""` (decorative) are no longer counted as
  missing alt; only images with no alt attribute fail.
- `public-preview/` retired — the npmjs package is now staged from the built
  `dist/` via `npm run stage:npmjs`.

## aeo-scan 0.0.2 (npmjs preview) — 2026-07-25

- `repository` field pointing at the now-public source; README links The AEO
  Standard. Fix: bin path without `./` prefix (current npm strips prefixed
  bin targets at publish, shipping a binary-less package).

## aeo-scan 0.0.1 (npmjs preview) — 2026-07-10

- Name claim: working single-URL preview checker (nine core signals).

## @isimplifyme/aeo-scan 0.1.0–0.1.2 (GitHub Packages, internal) — 2026-07-10/12

- Unified scanner replacing the per-repo `aeo-check.ts` / `aeo-scan.mjs` /
  `aeo-audit.mjs` copies: source-parse + fetch modes, tiers, sitemap
  discovery, `@graph`-aware JSON-LD parsing (the legacy scripts' bug class),
  Markdown reports, `process.exitCode` fix for piped output.
