import { Link, useRouter, useLocation } from '@tanstack/react-router'
import { cn } from '#/lib/utils'
import type { ReactNode } from 'react'

interface NavItemProps {
  to: string
  params?: Record<string, string>
  label: string
  icon: ReactNode
  exact?: boolean
}

function NavItem({ to, params, label, icon, exact = true }: NavItemProps) {
  const router = useRouter()
  const location = useLocation()
  const targetPathname = router.buildLocation({ to, params }).pathname
  const isCurrent = exact
    ? location.pathname === targetPathname
    : location.pathname.startsWith(targetPathname)

  return (
    <Link
      to={to}
      params={params}
      activeOptions={{ exact }}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150 ease-out',
        isCurrent
          ? 'bg-white/[0.05] text-white'
          : 'text-zinc-500 hover:bg-white/[0.02] hover:text-zinc-300',
      )}
    >
      <span
        className={cn(
          'grid h-4 w-4 shrink-0 place-items-center',
          isCurrent ? 'text-white' : 'text-zinc-500',
        )}
      >
        {icon}
      </span>
      <span className="leading-none tracking-wide">{label}</span>
    </Link>
  )
}

export { NavItem }
export default NavItem
