import type { StoryDefault } from '@ladle/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './card'
import { Button } from './button'

export default {
  title: 'Primitives/Card',
} satisfies StoryDefault

export const Default = () => (
  <Card className="w-80">
    <CardHeader>
      <CardTitle>Card Title</CardTitle>
      <CardDescription>Card description goes here</CardDescription>
    </CardHeader>
    <CardContent>
      <p>Card content — the main body area.</p>
    </CardContent>
    <CardFooter>
      <Button size="sm">Action</Button>
    </CardFooter>
  </Card>
)
