import { Bot, Settings2 } from 'lucide-react'
import NavItem from './NavItem'
import { HiMiniUserGroup } from 'react-icons/hi2'

function TeamSidebar() {
  return (
    <nav className="flex h-full flex-col gap-1">
      <NavItem to="/" label="Agents" icon={<Bot className="h-4 w-4" />} />
      <NavItem
        to="/members"
        label="Team"
        icon={<HiMiniUserGroup className="h-4 w-4" />}
      />
      <NavItem
        to="/settings"
        label="Settings"
        icon={<Settings2 className="h-4 w-4" />}
        exact={false}
      />
    </nav>
  )
}

export default TeamSidebar
