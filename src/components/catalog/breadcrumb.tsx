import Link from 'next/link'
import { monoLabel } from '@/components/ui/styles'

export type Crumb = { label: string; href?: string }

/** Home / … / current page. The last item is the current page and is not a link. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  const crumbs: Crumb[] = [{ label: 'Home', href: '/' }, ...items]
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-muted ${monoLabel}`}>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-2">
              {i > 0 ? <span aria-hidden="true">/</span> : null}
              {last || !c.href ? (
                <span aria-current={last ? 'page' : undefined} className="truncate text-ink">{c.label}</span>
              ) : (
                <Link href={c.href} className="hover:text-ink hover:underline">{c.label}</Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
