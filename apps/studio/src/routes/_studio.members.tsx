import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Check, Plus } from 'lucide-react'
import { Button } from '@/ui/button'
import { Dialog, DialogContent } from '#/ui'

export const Route = createFileRoute('/_studio/members')({
  component: MembersPage,
})

const MEMBERS = [
  {
    name: 'Admin',
    email: '',
    role: 'Owner' as const,
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
        <Button type="button" onClick={() => setIsOpen(true)} size="lg">
          <Plus className="h-3.5 w-3.5" />
          Invite Member
          <span className="ml-2 rounded-lg bg-gray-700 border border-gray-400 px-1.5 py-1 text-xs font-medium text-white">
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
            {MEMBERS.map((member) => (
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

      {isOpen ? (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-6xl! border-zinc-800 bg-[#0A0A0A] p-0 text-white shadow-2xl">
            <div className="relative overflow-hidden rounded-2xl">
              {/* background accents */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_40%)]" />
              <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px bg-white/5 lg:block" />

              <div className="flex flex-col lg:flex-row">
                {/* PRO LICENSE */}
                <div className="relative flex flex-1 flex-col p-8 lg:p-10">
                  <div className="mb-6 flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-semibold tracking-tight">
                          PRO License
                        </h2>
                      </div>

                      <p className="mt-1 text-sm text-zinc-400">
                        Lifetime access · Limited-time pricing
                      </p>
                    </div>
                  </div>

                  <div className="mb-8">
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-semibold tracking-tight">
                        $390
                      </span>

                      <span className="mb-1 text-sm text-zinc-500">
                        USD · one-time
                      </span>
                    </div>

                    <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">
                      Unlock collaboration and operational tooling for teams
                      building serious AI infrastructure with Kalp Studio.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      'Unlimited Team Members',
                      'Collaboration',
                      'Role-based access control (RBAC)',
                      'Multi-Tenant Workspaces',
                      'Shared environments & agents',
                      'Priority feature access',
                    ].map((feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/2 px-3 py-2.5"
                      >
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm text-zinc-300">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8">
                    <a
                      href="https://usekalp.com/license"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-medium text-black transition-all hover:bg-zinc-200"
                    >
                      Acquire License
                    </a>

                    <p className="mt-3 text-center text-xs text-zinc-500">
                      Founders pricing may increase after launch.
                    </p>
                  </div>
                </div>

                {/* ENTERPRISE */}
                <div className="relative flex flex-1 flex-col border-t border-white/5 bg-white/2 p-8 lg:border-l lg:border-t-0 lg:p-10">
                  <div className="mb-6 flex items-center gap-3">
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight">
                        Enterprise License
                      </h2>

                      <p className="mt-1 text-sm text-zinc-400">
                        Advanced security & dedicated support
                      </p>
                    </div>
                  </div>

                  <div className="mb-8">
                    <div className="text-4xl font-semibold tracking-tight">
                      Custom
                    </div>

                    <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">
                      Designed for organizations operating at scale with
                      advanced compliance, governance, and infrastructure
                      requirements.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      'Everything in PRO',
                      'Audit logs & activity tracking',
                      'Single Sign On (SSO)',
                      'Custom integrations',
                      'Priority infrastructure support',
                      'Dedicated onboarding & custom support',
                    ].map((feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5"
                      >
                        <Check className="h-4 w-4 text-cyan-400" />
                        <span className="text-sm text-zinc-300">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8">
                    <a
                      href="https://usekalp.com/enterprise"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-medium text-white transition-all hover:border-white/20 hover:bg-white/10"
                    >
                      Contact Enterprise Sales
                    </a>

                    <p className="mt-3 text-center text-xs text-zinc-500">
                      Tailored pricing & deployment options available.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/5 bg-black/30 px-6 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-500">
                    Need help choosing the right license?
                  </p>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="text-zinc-400 hover:text-white"
                  >
                    Maybe later
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
