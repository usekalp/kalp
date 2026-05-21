export const PROVIDERS = [
  { id: 'openai', label: 'OpenAI', icon: 'SiOpenai' },
  { id: 'anthropic', label: 'Anthropic', icon: 'SiAnthropic' },
  { id: 'openrouter', label: 'OpenRouter', icon: 'Globe' },
  { id: 'cloudflare-ai', label: 'Cloudflare AI Gateway', icon: 'SiCloudflare' },
  { id: 'vercel-ai', label: 'Vercel AI Gateway', icon: 'SiVercel' },
] as const

export const PROVIDER_CLI: Record<string, { flag: string; env: string }> = {
  openai: { flag: 'openai', env: 'OPENAI_API_KEY' },
  anthropic: { flag: 'anthropic', env: 'ANTHROPIC_API_KEY' },
  openrouter: { flag: 'openrouter', env: 'OPENROUTER_API_KEY' },
  'cloudflare-ai': { flag: 'cloudflare-ai', env: 'CLOUDFLARE_API_KEY' },
  'vercel-ai': { flag: 'vercel-ai', env: 'VERCEL_AI_API_KEY' },
}

export const SETTINGS_TABS = [
  { to: '/settings/secrets', label: 'Secrets' },
  { to: '/settings/ai', label: 'AI' },
  { to: '/settings/mcp', label: 'MCP' },
]
