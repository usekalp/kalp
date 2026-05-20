import { createFileRoute } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  MessageSquareText,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react'

export const Route = createFileRoute('/_studio/agent/$agentName/activity')({
  component: AgentActivityPage,
})

interface TimelineEvent {
  id: string
  type: 'call' | 'dispatch' | 'receive' | 'sleep' | 'schedule' | 'error' | 'chat'
  description: string
  timestamp: string
  duration?: string
  status: 'success' | 'running' | 'error'
}

const MOCK_EVENTS: TimelineEvent[] = [
  { id: 'evt-1', type: 'dispatch', description: 'agent.dispatch.processOrder', timestamp: '2m ago', duration: '340ms', status: 'success' },
  { id: 'evt-2', type: 'call', description: 'agent.call.validatePayment', timestamp: '2m ago', duration: '120ms', status: 'success' },
  { id: 'evt-3', type: 'receive', description: 'POST /webhook/payment-confirmed', timestamp: '3m ago', status: 'success' },
  { id: 'evt-4', type: 'chat', description: 'User: "Check order status"', timestamp: '5m ago', duration: '2.1s', status: 'success' },
  { id: 'evt-5', type: 'call', description: 'agent.call.getOrderStatus', timestamp: '5m ago', duration: '90ms', status: 'success' },
  { id: 'evt-6', type: 'schedule', description: 'cron.dailyReport — trigger', timestamp: '15m ago', status: 'success' },
  { id: 'evt-7', type: 'dispatch', description: 'agent.dispatch.sendReportEmail', timestamp: '15m ago', duration: '1.8s', status: 'success' },
  { id: 'evt-8', type: 'error', description: 'agent.call.fetchExternalData — timeout', timestamp: '22m ago', status: 'error' },
  { id: 'evt-9', type: 'sleep', description: 'agent.sleep(5m)', timestamp: '30m ago', status: 'success' },
  { id: 'evt-10', type: 'receive', description: 'POST /api/orders/webhook', timestamp: '35m ago', status: 'success' },
]

function AgentActivityPage() {
  return (
    <div>
      {MOCK_EVENTS.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-zinc-500">
            No activity yet. Events will appear here as the agent runs.
          </p>
        </div>
      ) : (
        <div>
          {MOCK_EVENTS.map((event) => {
            const isRunning = event.status === 'running'
            const isError = event.status === 'error'

            return (
              <div
                key={event.id}
                className="group flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-white/[0.03]"
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                  {isRunning ? (
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                  ) : isError ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : event.type === 'dispatch' ? (
                    <ArrowRightLeft className="h-4 w-4 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                </div>

                <span className="inline-flex shrink-0 items-center rounded-full border border-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-zinc-400">
                  {event.type}
                </span>

                <code className="min-w-0 flex-1 truncate text-xs text-zinc-500">
                  {event.description}
                </code>

                <div className="shrink-0 text-right">
                  <p className="text-xs text-zinc-600">{event.timestamp}</p>
                  {event.duration ? (
                    <p className="text-[11px] text-zinc-700">
                      {event.duration}
                    </p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
