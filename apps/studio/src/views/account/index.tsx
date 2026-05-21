import { PasswordForm } from '#/features/account/components/password-form'
import { AnimatedPage } from '../animated-page'

export function AccountView() {
  return (
    <AnimatedPage>
      <div>
        <h1 className="mb-5 text-base font-medium tracking-tight text-white">
          Account
        </h1>

        <div className="mb-6 flex gap-1 border-b border-zinc-800">
          <span className="border-b-2 border-white/60 px-3 py-2 text-xs font-medium text-white">
            Security
          </span>
        </div>

        <div className="space-y-5">
          <PasswordForm />
        </div>
      </div>
    </AnimatedPage>
  )
}

