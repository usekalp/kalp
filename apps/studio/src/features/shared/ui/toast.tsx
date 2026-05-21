import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, X, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '#/ui/button'
import { useToast } from '#/features/shared/hooks/use-toast'
import type { ToastType } from './toast-provider'

const ICONS: Record<ToastType, LucideIcon> = {
  success: CheckCircle,
  error: XCircle,
}

const ICON_COLORS: Record<ToastType, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-100 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.type]
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="flex min-w-72 max-w-sm items-center gap-3 rounded-xl border border-zinc-800 bg-[#0D0D0D] px-4 py-3 shadow-xl"
            >
              <Icon className={`h-4 w-4 shrink-0 ${ICON_COLORS[t.type]}`} />
              <p className="flex-1 text-xs text-zinc-300">{t.message}</p>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeToast(t.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
