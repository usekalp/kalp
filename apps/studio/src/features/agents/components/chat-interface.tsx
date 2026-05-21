import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Send } from 'lucide-react'
import { Badge } from '#/ui/badge'
import { Button } from '#/ui/button'
import { ScrollArea } from '#/ui/scroll-area'
import { Skeleton } from '#/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/ui/select'
import { Textarea } from '#/ui/textarea'
import { useAgent } from '../hooks/use-agent'
import { useChatMessages } from '../hooks/use-chat'
import { useSendChatMessage } from '../hooks/use-send-chat-message'

interface ChatInterfaceProps {
  agentName: string
}

export function ChatInterface({ agentName }: ChatInterfaceProps) {
  const agentQuery = useAgent(agentName)
  const agent = agentQuery.data
  const [draft, setDraft] = useState('')
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (!activeSessionId && agent?.chatSessions?.[0]?.id) {
      setActiveSessionId(agent.chatSessions[0].id)
    }
  }, [activeSessionId, agent?.chatSessions])

  const chatSessionId = activeSessionId ?? agent?.chatSessions?.[0]?.id ?? ''
  const chatMessagesQuery = useChatMessages(agentName, chatSessionId)
  const sendMessage = useSendChatMessage(agentName)

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
          <div className="h-8 w-48">
            <Skeleton />
          </div>
          <div className="flex-1">
            <Skeleton />
          </div>
          <div className="h-24">
            <Skeleton />
          </div>
        </div>
      ) : !agent ? (
        <p className="text-sm text-zinc-500">Agent not found.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant={agent.chat.supportsChat ? 'default' : 'outline'}>
              {agent.chat.supportsChat
                ? 'Message hook detected'
                : 'No message hook'}
            </Badge>
            <Badge variant="outline">
              Streaming:{' '}
              {agent.chat.supportsStreaming ? 'ready' : 'polling contract'}
            </Badge>
            <Badge variant="outline">
              History: {agent.chat.supportsHistory ? 'enabled' : 'disabled'}
            </Badge>

            {agent.chatSessions?.length > 1 ? (
              <Select value={chatSessionId} onValueChange={setActiveSessionId}>
                <div className="ml-auto">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </div>
                <SelectContent>
                  {agent.chatSessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title ?? s.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>

          <div className="flex-1">
            <ScrollArea>
              <div className="space-y-3">
                {recentMessages?.length === 0 ? (
                  <p className="py-12 text-center text-sm text-zinc-500">
                    No chat history yet. Send a message to create a live
                    session.
                  </p>
                ) : (
                  recentMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-xl border px-3 py-2 ${
                        message.role === 'assistant'
                          ? 'border-indigo-400/20 bg-indigo-400/10'
                          : 'border-zinc-800 bg-white/2'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-zinc-500">
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
          </div>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-[#0A0A0A] p-3">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                agent.chat.supportsChat
                  ? 'Send a runtime message...'
                  : 'This agent does not expose a message hook yet.'
              }
              disabled={!agent.chat.supportsChat || sendMessage.isPending}
            />
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-zinc-600">
                Session:{' '}
                {chatSessionId ? chatSessionId.slice(0, 12) + '...' : 'new'}
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
