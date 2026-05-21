import { Plus } from 'lucide-react'
import { Button } from '#/ui/button'
import type { TeamMember } from '../types'

interface MemberTableProps {
  members: TeamMember[]
  onInvite?: () => void
}

export function MemberTable({ members, onInvite }: MemberTableProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-medium tracking-tight text-white">Members</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Manage team access and roles in this Workspace.
          </p>
        </div>
        <Button type="button" onClick={onInvite} size="lg">
          <Plus className="h-3.5 w-3.5" />
          Invite Member
          <span className="ml-1 rounded-lg bg-gray-800 border border-gray-400 px-1.5 py-1 text-[10px] font-medium text-white">
            PRO
          </span>
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-widest text-zinc-600">
                Name / Email
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-widest text-zinc-600">
                Role
              </th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr
                key={member.email}
                className="border-b border-zinc-800 last:border-0 transition-colors hover:bg-white/2"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/6 text-xs font-medium text-zinc-400">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">{member.name}</p>
                      <p className="text-[11px] text-zinc-500">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-xl bg-white/6 px-2 py-0.5 text-xs font-medium text-zinc-300">
                    {member.role}
                  </span>
                </td>
                <td className="px-4 py-3" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
