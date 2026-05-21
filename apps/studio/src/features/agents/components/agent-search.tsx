import { Search } from 'lucide-react'
import { Input } from '#/ui/input'

interface AgentSearchProps {
  value: string
  onChange: (value: string) => void
}

export function AgentSearch({ value, onChange }: AgentSearchProps) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name, label..."
        className="pl-9 h-10"
      />
    </div>
  )
}
