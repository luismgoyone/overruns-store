export function isProtectedAdminPath(pathname: string): boolean {
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) return false
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

export function safeNextPath(next: string | null | undefined): string {
  if (!next || next.startsWith('//') || !(next === '/admin' || next.startsWith('/admin/'))) return '/admin'
  return next
}
