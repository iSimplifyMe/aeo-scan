/** sitemap.xml route discovery (ported from subdial aeo-audit.mjs). */

export function parseSitemap(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
}

/** Fetch a sitemap and return its URLs as paths relative to the base. */
export async function routesFromSitemap(base: string, userAgent: string): Promise<string[]> {
  const cleanBase = base.replace(/\/$/, '')
  const res = await fetch(`${cleanBase}/sitemap.xml`, { headers: { 'User-Agent': userAgent } })
  if (!res.ok) throw new Error(`sitemap.xml fetch failed: HTTP ${res.status}`)
  const urls = parseSitemap(await res.text())
  return urls.map((u) => {
    try {
      return new URL(u).pathname || '/'
    } catch {
      return u.startsWith('/') ? u : `/${u}`
    }
  })
}
