import { Filter } from 'lucide-react'
import { Button } from '#/ui/button'
import { Label } from '#/ui/label'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '#/ui/dropdown-menu'

const STATUSES = ['online', 'offline']

interface AgentFiltersProps {
  statuses: string[]
  tags: string[]
  allTags: string[]
  onStatusChange: (s: string[]) => void
  onTagChange: (t: string[]) => void
}

export function AgentFilters({
  statuses,
  tags,
  allTags,
  onStatusChange,
  onTagChange,
}: AgentFiltersProps) {
  return (
    <div className="flex items-start gap-2">
      <div className="space-y-1.5">
        <Label>Filter by Status</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="lg"
              className="w-55 justify-start gap-2 text-muted-foreground!"
            >
              {statuses.length > 0 ? (
                <>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/8 text-[10px] text-muted-foreground">
                    {statuses.length}
                  </span>
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                </>
              ) : (
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              Any
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {STATUSES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={statuses.includes(s)}
                onCheckedChange={() => {
                  const next = statuses.includes(s)
                    ? statuses.filter((st) => st !== s)
                    : [...statuses, s]
                  onStatusChange(next)
                }}
                onSelect={(e) => e.preventDefault()}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-1.5">
        <Label>Filter by Tags</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="lg"
              className="w-55 justify-start gap-2 text-muted-foreground!"
            >
              {tags.length > 0 ? (
                <>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/8 text-[10px] text-muted-foreground">
                    {tags.length}
                  </span>
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                </>
              ) : (
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              Any
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {allTags.map((tag) => (
              <DropdownMenuCheckboxItem
                key={tag}
                checked={tags.includes(tag)}
                onCheckedChange={() => {
                  const next = tags.includes(tag)
                    ? tags.filter((t) => t !== tag)
                    : [...tags, tag]
                  onTagChange(next)
                }}
                onSelect={(e) => e.preventDefault()}
              >
                {tag}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
