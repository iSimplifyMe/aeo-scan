# aeo-scan

Score any page the way AI answer engines read it.

**This is an early preview (v0.0.x).** It checks one URL for the core structural
signals AI answer engines (ChatGPT, Perplexity, Gemini, Claude) rely on when
deciding what to extract and cite:

```
npx aeo-scan https://example.com/some-page
```

Preview checks: title and meta-description length bands, canonical, single H1,
OG tags, JSON-LD schema types, BreadcrumbList presence, FAQPage Q&A count.

## The AEO Standard

The full CLI scores pages against **The AEO Standard** — a 100-point,
7-section Answer Engine Optimization rubric (Substance & Originality, Atomic
Answer Blocks, Structured Data, RAG/Retrieval Readiness, Semantic HTML,
Internal Linking & Fan-Out, SEO Meta) with hard gating rules for hidden
machine-only content and fabricated authority.

One principle underneath it: **AI engines cite content that is genuinely worth
citing.** Structure makes content extractable; substance makes it citable. A
structural score is a floor, not a forecast.

The versioned methodology and the full CLI (sitemap crawls, CI exit codes,
optional LLM-scored substance checks) are in development.

- Web scanner today: https://isimplifyme.com/tools/aeo-scanner
- Maintained by [iSimplifyMe](https://isimplifyme.com)

MIT © iSimplifyMe
