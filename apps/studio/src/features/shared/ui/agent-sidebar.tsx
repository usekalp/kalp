import { Link } from '@tanstack/react-router'
import {
  Activity,
  ArrowLeft,
  BrainCircuit,
  MessageSquareText,
  Radar,
  Route as RouteIcon,
  Workflow,
} from 'lucide-react'
import { NavItem } from '#/features/shared/ui/nav-item'

interface AgentSidebarProps {
  agentName: string
}

function AgentSidebar({ agentName }: AgentSidebarProps) {
  return (
    <nav className="flex h-full flex-col gap-1">
      <Link
        to="/"
        search={{ status: '', tags: '' }}
        className="mb-2 flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-zinc-500 transition-colors duration-150 ease-out hover:text-zinc-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Workspace
      </Link>

      <NavItem
        to="/agent/$agentName"
        params={{ agentName }}
        label="Overview"
        icon={<Workflow className="h-4 w-4" />}
      />
      <NavItem
        to="/agent/$agentName/activity"
        params={{ agentName }}
        label="Activity"
        icon={<Activity className="h-4 w-4" />}
      />
      <NavItem
        to="/agent/$agentName/chat"
        params={{ agentName }}
        label="Chat"
        icon={<MessageSquareText className="h-4 w-4" />}
      />
      <NavItem
        to="/agent/$agentName/replay"
        params={{ agentName }}
        label="Replay"
        icon={<Radar className="h-4 w-4" />}
      />
      <NavItem
        to="/agent/$agentName/state"
        params={{ agentName }}
        label="State"
        icon={<BrainCircuit className="h-4 w-4" />}
        exact={false}
      />
      <NavItem
        to="/agent/$agentName/topology"
        params={{ agentName }}
        label="Topology"
        icon={<RouteIcon className="h-4 w-4" />}
        exact={false}
      />
    </nav>
  )
}

export default AgentSidebar
