const entryPaths = new Set(['/api', '/api/index', '/api/index.mjs', '/api/index.js'])

function forwardedPath(value) {
  if (Array.isArray(value)) {
    if (!value.every(part => typeof part === 'string')) return null
    value = value.join('/')
  }
  if (typeof value !== 'string' || value.length > 160) return null
  try { value = decodeURIComponent(value) } catch { return null }
  value = value.replace(/^\/+|\/+$/g, '')
  if (value.startsWith('api/')) value = value.slice(4).replace(/^\/+/, '')
  return /^[a-z-]+(?:\/[a-z-]+)*$/.test(value) ? `/api/${value}` : null
}

export function resolveApiPath(request) {
  const url = new URL(request.url, 'https://localhost')
  const pathname = url.pathname.replace(/\/+$/, '')
  // Vercel may keep the original request URL or expose the rewritten entry point.
  // A real endpoint path takes precedence over unrelated client query parameters.
  if (!entryPaths.has(pathname)) return pathname
  const query = request.query
  const value = query?.__makrab_path ?? url.searchParams.get('__makrab_path')
    ?? query?.route ?? url.searchParams.get('route')
    ?? query?.path ?? url.searchParams.get('path')
  return forwardedPath(value) ?? pathname
}
