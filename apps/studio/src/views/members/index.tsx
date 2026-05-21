import { useState } from 'react'
import { MemberTable } from '#/features/team/components/member-table'
import { LicenseDialog } from '#/features/team/components/license-dialog'
import { AnimatedPage } from '../animated-page'

const MEMBERS = [
  {
    name: 'Admin',
    email: '',
    role: 'Owner' as const,
    isCurrent: true,
  },
]

export function MembersView() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <AnimatedPage>
      <div className="space-y-6">
        <MemberTable members={MEMBERS} onInvite={() => setIsOpen(true)} />
        <LicenseDialog open={isOpen} onOpenChange={setIsOpen} />
      </div>
    </AnimatedPage>
  )
}

