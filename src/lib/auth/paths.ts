export function isProtectedAdminPath(pathname: string): boolean {
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) return false
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

const BASE = 'http://internal.invalid'

// Resolves `..`, encoded dots and backslashes like a browser would, then only allows same-origin /admin paths.
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/')) return '/admin'
  let url: URL
  try {
    url = new URL(next, BASE)
  } catch {
    return '/admin'
  }
  if (url.origin !== BASE) return '/admin'
  if (!(url.pathname === '/admin' || url.pathname.startsWith('/admin/'))) return '/admin'
  return url.pathname + url.search
}
