import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Activity,
  CalendarClock,
  Cloud,
  Globe,
  MemoryStick,
  MessageSquareText,
  Route as RouteIcon,
  Send,
  Server,
  Sparkles,
} from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { ScrollArea } from '#/components/ui/scroll-area'
import { Skeleton } from '#/components/ui/skeleton'
import {
  useRuntimeAgent,
  useRuntimeChatSession,
  useSendAgentChatMessage,
} from '#/hooks/useRuntimeSubscriptions'

export const Route = createFileRoute('/_studio/agent/$agentName/')({
  component: AgentOverviewPage,
})

function AgentOverviewPage() {
  const { agentName } = Route.useParams()
  const agentQuery = useRuntimeAgent(agentName)
  const agent = agentQuery.data
  const [draft, setDraft] = useState('')
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (!activeSessionId && agent?.chatSessions?.[0]?.id) {
      setActiveSessionId(agent.chatSessions[0].id)
    }
  }, [activeSessionId, agent?.chatSessions])

  const chatSessionId = activeSessionId ?? agent?.chatSessions?.[0]?.id ?? ''
  const chatMessagesQuery = useRuntimeChatSession(agentName, chatSessionId)
  const sendMessage = useSendAgentChatMessage(agentName)

  const recentEntrypoints = useMemo(() => agent?.entrypoints ?? [], [agent])
  const stateSummary = useMemo(() => agent?.state.summary ?? [], [agent])
  const recentMessages = chatMessagesQuery.data ?? []

  const onSend = async () => {
    const message = draft.trim()
    if (!message) return
    const result = await sendMessage.mutateAsync({
      message,
      sessionId: activeSessionId ?? undefined,
    })
    setActiveSessionId(result.session.id)
    setDraft('')
  }

  return (
    <section className="grid gap-4 xl:grid-cols-12">
      {agentQuery.isLoading && (
        <>
          <Skeleton className="h-44 w-full studio-tile xl:col-span-6" />
          <Skeleton className="h-44 w-full studio-tile xl:col-span-6" />
          <Skeleton className="h-105 w-full studio-tile xl:col-span-7" />
          <Skeleton className="h-105 w-full studio-tile xl:col-span-5" />
        </>
      )}

      {agent && (
        <>
          <Card className="studio-tile xl:col-span-6">
            <CardHeader>
              <CardTitle className="studio-metal-text flex items-center gap-2 text-base">
                <Server className="h-4 w-4 text-primary" />
                Runtime Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <MetricTile
                label="Environment"
                value={agent.environment}
                icon={<Cloud className="h-3.5 w-3.5" />}
              />
              <MetricTile
                label="Status"
                value={agent.status}
                icon={<Activity className="h-3.5 w-3.5" />}
                badge={
                  <Badge
                    variant={agent.status === 'online' ? 'default' : 'outline'}
                    className={
                      agent.status === 'online'
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : ''
                    }
                  >
                    {agent.status}
                  </Badge>
                }
              />
              <MetricTile label="Version" value={agent.version ?? 'v0'} />
              <MetricTile label="Updated" value={agent.updatedAt ?? 'n/a'} />
              <MetricTile
                label="Routes"
                value={String(agent.routes.length)}
                icon={<RouteIcon className="h-3.5 w-3.5" />}
              />
              <MetricTile
                label="Executions"
                value={String(agent.executionStats.total)}
                icon={<Sparkles className="h-3.5 w-3.5" />}
              />
            </CardContent>
          </Card>

          <Card className="studio-tile xl:col-span-6">
            <CardHeader>
              <CardTitle className="studio-metal-text flex items-center gap-2 text-base">
                <Globe className="h-4 w-4 text-primary" />
                Endpoint & Deploy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="truncate">Local path: {agent.localPath ?? 'n/a'}</p>
              <p className="truncate">Hash: {agent.hash ?? 'n/a'}</p>
              {agent.workerUrl ? (
                <a
                  href={agent.workerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-primary hover:underline"
                >
                  {agent.workerUrl}
                </a>
              ) : (
                <p>Agent has not been deployed yet.</p>
              )}

              {agent.requirements &&
              Object.keys(agent.requirements).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(agent.requirements).map(([key, value]) => (
                    <Badge
                      key={key}
                      variant="outline"
                      className="border-white/10 text-zinc-300"
                    >
                      {key}:{value}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="studio-tile rounded-5 xl:col-span-7">
            <CardHeader>
              <CardTitle className="studio-metal-text flex items-center gap-2 text-base">
                <MessageSquareText className="h-4 w-4 text-primary" />
                Agent Chat Console
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={agent.chat.supportsChat ? 'default' : 'outline'}
                  className={
                    agent.chat.supportsChat
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : 'text-zinc-500'
                  }
                >
                  {agent.chat.supportsChat
                    ? 'Message hook detected'
                    : 'No message hook'}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-white/10 text-zinc-400"
                >
                  Streaming:{' '}
                  {agent.chat.supportsStreaming ? 'ready' : 'polling contract'}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-white/10 text-zinc-400"
                >
                  History: {agent.chat.supportsHistory ? 'enabled' : 'disabled'}
                </Badge>
              </div>

              <ScrollArea className="h-65 rounded-5 border border-white/10 bg-black/20 p-3">
                <div className="space-y-3">
                  {recentMessages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No chat history yet. Send a message to create a live
                      session.
                    </p>
                  ) : (
                    recentMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`rounded-5 border px-3 py-2 ${
                          message.role === 'assistant'
                            ? 'border-indigo-400/20 bg-indigo-400/10'
                            : 'border-white/10 bg-white/3'
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between text-3xs uppercase tracking-tightest text-zinc-500">
                          <span>{message.role}</span>
                          <span>
                            {new Date(message.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-zinc-100">
                          {message.content}
                        </p>
                        {message.executionId ? (
                          <Link
                            to="/replay/$executionId"
                            params={{ executionId: message.executionId }}
                            className="mt-2 inline-flex text-xs text-primary hover:underline"
                          >
                            Open execution replay
                          </Link>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              <div className="rounded-5 border border-white/10 bg-black/20 p-3">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={
                    agent.chat.supportsChat
                      ? 'Send a runtime message to the message hook...'
                      : 'This agent does not expose a message hook yet.'
                  }
                  disabled={!agent.chat.supportsChat || sendMessage.isPending}
                  className="min-h-24 w-full resize-none rounded-5 border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                />
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Current session: {chatSessionId || 'new session'}
                  </p>
                  <Button
                    size="sm"
                    onClick={onSend}
                    disabled={
                      !agent.chat.supportsChat ||
                      sendMessage.isPending ||
                      draft.trim().length === 0
                    }
                  >
                    <Send className="mr-2 h-3.5 w-3.5" />
                    {sendMessage.isPending ? 'Sending...' : 'Send message'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="studio-tile rounded-5 xl:col-span-5">
            <CardHeader>
              <CardTitle className="studio-metal-text flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Entrypoints & Runtime State
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {recentEntrypoints.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-5 border border-white/10 bg-black/25 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {entry.kind === 'route' ? (
                          <RouteIcon className="h-4 w-4 text-zinc-300" />
                        ) : entry.kind === 'hook' ? (
                          <MessageSquareText className="h-4 w-4 text-zinc-300" />
                        ) : entry.kind === 'listener' ? (
                          <Sparkles className="h-4 w-4 text-zinc-300" />
                        ) : (
                          <CalendarClock className="h-4 w-4 text-zinc-300" />
                        )}
                        <span className="font-medium text-zinc-100">
                          {entry.title}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-white/10 text-zinc-300"
                      >
                        {entry.kind}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-400">
                      {entry.method ? `${entry.method} ` : ''}
                      {entry.path ?? entry.stableName ?? entry.id}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-5 border border-white/10 bg-black/25 p-3">
                <div className="mb-3 flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-primary" />
                  <span className="font-medium text-zinc-100">
                    State surface
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {stateSummary.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-5 border border-white/10 bg-black/30 p-3"
                    >
                      <p className="text-2xs uppercase tracking-tighter text-zinc-500">
                        {item.key}
                      </p>
                      <p className="mt-1 text-sm font-medium text-zinc-100">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
                {!agent.state.availability.supported ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {agent.state.availability.reason}
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  )
}

function MetricTile({
  label,
  value,
  icon,
  badge,
}: {
  label: string
  value: string
  icon?: ReactNode
  badge?: ReactNode
}) {
  return (
    <div className="rounded-5 border border-white/10 bg-black/20 p-3">
      <p className="mb-1 text-2xs uppercase tracking-tighter text-zinc-500">
        {label}
      </p>
      {badge ?? (
        <div className="flex items-center gap-1 text-zinc-100">
          {icon}
          {value}
        </div>
      )}
    </div>
  )
}
