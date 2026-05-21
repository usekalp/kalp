export function formatTrigger(trigger: unknown): string {
  if (!trigger) return 'Unknown trigger'
  if (typeof trigger === 'string') return trigger
  return JSON.stringify(trigger)
}
