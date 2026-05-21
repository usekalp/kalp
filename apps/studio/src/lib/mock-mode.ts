export function isMockMode(): boolean {
  return import.meta.env.VITE_USE_MOCKS === 'true'
}
