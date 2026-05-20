import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { MessageSquareText, Send, Waves } from 'lucide-react'
import { Badge } from '@kalphq/ui/badge'
import { Button } from '@kalphq/ui/button'
import { ScrollArea } from '@kalphq/ui/scroll-area'
import { Skeleton } from '@kalphq/ui/skeleton'
import {
  useRuntimeAgent,
  useRuntimeChatSession,
  useSendAgentChatMessage,
} from '#/hooks/useRuntimeSubscriptions'

export const Route = createFileRoute('/_studio/agent/$agentName/chat')({
  component: AgentChatPage,
})

function AgentChatPage() {
  const { agentName } = Route.useParams()
  const agentQuery = useRuntimeAgent(agentName)
  const agent = agentQuery.data
  const [draft, setDraft] = useState('')
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (!activeSessionId && agent?.chatSessions[0]?.id) {
      setActiveSessionId(agent.chatSessions[0].id)
    }
  }, [activeSessionId, agent?.chatSessions])

  const chatSessionId = activeSessionId ?? agent?.chatSessions[0]?.id ?? ''
  const chatMessagesQuery = useRuntimeChatSession(agentName, chatSessionId)
  const sendMessage = useSendAgentChatMessage(agentName)

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
    <div className="flex h-[calc(100vh-15rem)] flex-col">
      {agentQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="flex-1" />
          <Skeleton className="h-24" />
        </div>
      ) : !agent ? (
        <p className="text-sm text-zinc-500">Agent not found.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
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

            {agent.chatSessions.length > 1 ? (
              <select
                value={chatSessionId}
                onChange={(e) => setActiveSessionId(e.target.value)}
                className="ml-auto rounded border border-white/[0.06] bg-black/30 px-2 py-1 text-xs text-zinc-400 outline-none"
              >
                {agent.chatSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label ?? s.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <ScrollArea className="flex-1 rounded-lg border border-white/[0.04] bg-black/20 p-4">
            <div className="space-y-3">
              {recentMessages.length === 0 ? (
                <p className="py-12 text-center text-sm text-zinc-500">
                  No chat history yet. Send a message to create a live session.
                </p>
              ) : (
                recentMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-lg border px-3 py-2 ${
                      message.role === 'assistant'
                        ? 'border-indigo-400/20 bg-indigo-400/10'
                        : 'border-white/[0.04] bg-white/[0.02]'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.1em] text-zinc-500">
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
                        className="mt-2 inline-flex text-xs text-zinc-400 hover:text-zinc-200"
                      >
                        Open execution replay
                      </Link>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="mt-4 rounded-lg border border-white/[0.04] bg-black/20 p-3">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                agent.chat.supportsChat
                  ? 'Send a runtime message...'
                  : 'This agent does not expose a message hook yet.'
              }
              disabled={!agent.chat.supportsChat || sendMessage.isPending}
              className="min-h-20 w-full resize-none rounded-md border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            />
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-zinc-600">
                Session: {chatSessionId ? chatSessionId.slice(0, 12) + '...' : 'new'}
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
                {sendMessage.isPending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
