import { Check, ExternalLink } from 'lucide-react'
import { Button } from '#/ui/button'
import { Dialog, DialogContent, DialogTitle } from '#/ui'
import { PRO_PLAN, ENTERPRISE_PLAN } from '../constants'

interface LicenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LicenseDialog({ open, onOpenChange }: LicenseDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl! border-zinc-800 bg-[#0A0A0A] p-0 text-white shadow-2xl">
        <DialogTitle className="sr-only">License Plans</DialogTitle>
        <div className="relative overflow-hidden rounded-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_40%)]" />
          <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px bg-white/5 lg:block" />

          <div className="flex flex-col lg:flex-row">
            <div className="relative flex flex-1 flex-col p-8 lg:p-10">
              <div className="mb-6 flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-semibold tracking-tight">{PRO_PLAN.name}</h2>
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">Lifetime access · Limited-time offer</p>
                </div>
              </div>

              <div className="mb-8">
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-semibold tracking-tight">{PRO_PLAN.price}</span>
                  <span className="mb-1 text-sm text-zinc-500">
                    USD{' '}
                    <strong className="px-2 py-1 border border-gray-800 text-white rounded-lg">One-Time</strong>
                  </span>
                </div>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">
                  {PRO_PLAN.description}
                </p>
              </div>

              <div className="space-y-3">
                {PRO_PLAN.features.map((feature) => (
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
                  Acquire License{' '}
                  <ExternalLink className="ml-2 mb-0.5 w-3.5 h-3.5" />
                </a>
                <p className="mt-3 text-center text-xs text-zinc-500">
                  Founders pricing may increase after launch.
                </p>
              </div>
            </div>

            <div className="relative flex flex-1 flex-col border-t border-white/5 bg-white/2 p-8 lg:border-l lg:border-t-0 lg:p-10">
              <div className="mb-6 flex items-center gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">{ENTERPRISE_PLAN.name}</h2>
                  <p className="mt-1 text-sm text-zinc-400">Advanced security & dedicated support</p>
                </div>
              </div>

              <div className="mb-8">
                <div className="text-4xl font-semibold tracking-tight">{ENTERPRISE_PLAN.price}</div>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">
                  {ENTERPRISE_PLAN.description}
                </p>
              </div>

              <div className="space-y-3">
                {ENTERPRISE_PLAN.features.map((feature) => (
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
                  Contact Enterprise Sales{' '}
                  <ExternalLink className="ml-2 mb-0.5 w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 bg-black/30 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-zinc-400 hover:text-white"
            >
              Maybe later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
