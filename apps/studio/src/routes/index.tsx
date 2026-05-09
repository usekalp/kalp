/**
 * Dashboard page displaying recent executions.
 * Lists executions from the global D1 index.
 *
 * @module
 */

import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { useExecutions } from '#/hooks/useEventLog'
import { useAuth } from '#/hooks/useAuth'
import type { ExecutionSummary } from '#/types/events'

const studioSearchSchema = z.object({
  token: z.string().optional(),
})

export const Route = createFileRoute('/')({
  component: Dashboard,
  validateSearch: studioSearchSchema,
})

function Dashboard() {
  const { isAuthenticated } = useAuth()
  const { data: executions, isLoading } = useExecutions()

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Please run <code>kalp studio</code> from your terminal to
              authenticate.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Recent Executions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Execution ID</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions?.map((execution) => (
                  <ExecutionRow
                    key={execution.execution_id}
                    execution={execution}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ExecutionRow({ execution }: { execution: ExecutionSummary }) {
  const getStatusVariant = (status: ExecutionSummary['status']) => {
    switch (status) {
      case 'running':
        return 'default'
      case 'completed':
        return 'secondary'
      case 'error':
        return 'destructive'
      case 'suspended':
        return 'outline'
      default:
        return 'default'
    }
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">
        {execution.execution_id.slice(0, 8)}...
      </TableCell>
      <TableCell>{execution.agent_name}</TableCell>
      <TableCell>
        <Badge variant={getStatusVariant(execution.status)}>
          {execution.status}
        </Badge>
      </TableCell>
      <TableCell>{new Date(execution.started_at).toLocaleString()}</TableCell>
      <TableCell>{execution.event_count}</TableCell>
      <TableCell>
        <Link
          to="/replay/$executionId"
          params={{ executionId: execution.execution_id }}
          search={{ threadId: execution.thread_id }}
          className="text-primary hover:underline"
        >
          Replay
        </Link>
      </TableCell>
    </TableRow>
  )
}
