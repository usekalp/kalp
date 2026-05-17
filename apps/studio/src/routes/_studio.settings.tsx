import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'

export const Route = createFileRoute('/_studio/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <Card className="border-white/10 bg-white/3">
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Team settings stub for Studio
      </CardContent>
    </Card>
  )
}
