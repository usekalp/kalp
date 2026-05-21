import { useNavigate } from '@tanstack/react-router'
import { Laptop, LogOut, Search, User } from 'lucide-react'
import {
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui'
import { signOut, useAuth } from '#/hooks/useAuth'

function StudioHeader() {
  const { username } = useAuth()
  const navigate = useNavigate()

  const onLogout = async () => {
    await signOut()
    window.location.href = '/studio/login'
  }

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-900 px-4">
      <div className="flex items-center gap-3">
        <a href="/studio/">
          <img
            src="/studio/kalp-logo.png"
            alt="Kalp"
            className="h-7 w-auto object-contain"
          />
        </a>
      </div>

      <button
        type="button"
        onClick={() =>
          window.dispatchEvent(new CustomEvent('toggle-command-palette'))
        }
        className="mx-auto flex w-80 items-center gap-2 rounded-xl border border-zinc-800 bg-white/2 px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300 cursor-pointer"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span>Search pages and agents...</span>
        <kbd className="ml-auto rounded border border-zinc-800 px-1 py-0.5 text-[10px] text-zinc-600">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-4">
        <div className="inline-flex items-center gap-2">
          <Laptop className="h-3.5 w-3.5 text-zinc-600" />
          <span className="text-xs text-zinc-500">Local Engine</span>
        </div>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Avatar className="h-8.5 w-8.5 cursor-pointer transition-colors group">
              <AvatarFallback>
                {username?.slice(0, 2).toUpperCase() ?? 'AD'}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-white">
                {username ?? 'admin'}
              </p>
              <p className="text-[11px] text-zinc-500">{username}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate({ to: '/account' })}>
              <User className="h-3 w-3" />
              Account Preferences
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout}>
              <LogOut className="h-3 w-3" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

export default StudioHeader
