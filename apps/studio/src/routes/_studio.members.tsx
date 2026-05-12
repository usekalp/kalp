import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'

export const Route = createFileRoute('/_studio/members')({
  component: MembersPage,
})

function MembersPage() {
  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardHeader>
        <CardTitle>Members</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Members view stub for Studio. Próximo paso: team/member API.
      </CardContent>
    </Card>
  )
}
