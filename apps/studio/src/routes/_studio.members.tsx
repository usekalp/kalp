import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Lock, Plus, Users } from 'lucide-react'

export const Route = createFileRoute('/_studio/members')({
  component: MembersPage,
})

const MEMBERS = [
  {
    name: 'Admin',
    email: 'admin@workspace.com',
    role: 'Owner' as const,
    status: 'Active' as const,
    isCurrent: true,
  },
]

function MembersPage() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-medium tracking-tight text-white">
            Members
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Manage team access and roles in this Workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-800 bg-white px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-zinc-100"
        >
          <Plus className="h-3.5 w-3.5" />
          Invite Member
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-600">
                Name / Email
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-600">
                Role
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-600">
                Status
              </th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {MEMBERS.map((member) => (
              <tr
                key={member.email}
                className="border-b border-zinc-800 last:border-0 transition-colors hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-medium text-zinc-400">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">
                        {member.name}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {member.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-xl bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-zinc-300">
                    {member.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {member.status}
                  </span>
                </td>
                <td className="px-4 py-3" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-800 px-4 py-3">
        <Lock className="h-3.5 w-3.5 text-zinc-600" />
        <p className="text-xs text-zinc-600">
          Invite team members to collaborate on agents, share storage, and
          manage secrets together.
        </p>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="mx-4 w-full max-w-md rounded-xl border border-zinc-800 bg-[#0D0D0D] p-8">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.04]">
              <Users className="h-8 w-8 text-zinc-500" />
            </div>

            <h2 className="text-center text-lg font-semibold text-white">
              Upgrade to Team Edition
            </h2>

            <p className="mt-3 text-center text-sm leading-relaxed text-zinc-400">
              Real-time collaboration, role-based access control (RBAC), and
              multi-tenant management are reserved for Agency or Enterprise
              license holders. Unlock Kalp Studio for your entire team and scale
              your agent infrastructure.
            </p>

            <a
              href="https://usekalp.com/license"
              target="_blank"
              rel="noreferrer"
              className="mt-6 block w-full rounded-xl bg-white px-4 py-2.5 text-center text-sm font-medium text-black transition-all hover:bg-zinc-200"
            >
              Acquire License — usekalp.com/license
            </a>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="mt-4 block w-full text-center text-sm text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
