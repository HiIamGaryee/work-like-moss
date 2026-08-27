const reported = new Set<string>()

export function devWarn(message: string): void {
  if (!import.meta.env.DEV || reported.has(message)) return
  reported.add(message)
  console.warn(`[hr-data] ${message}`)
}
