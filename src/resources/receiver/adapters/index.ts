import type { InboundEvent } from '@/domain/events'
import { parseInstagram, type InstagramWebhook } from '@/resources/receiver/adapters/instagram'

// A webhook can batch several events; per-item parsing failures are returned in `errors`.
export type ParseResult = { events: InboundEvent[]; errors: unknown[] }

// One parser per source.
const parsers = new Map<string, (raw: unknown) => ParseResult>([
  ['instagram', raw => parseInstagram(raw as InstagramWebhook)],
])

export function parseInbound(source: string, raw: unknown): ParseResult {
  const parse = parsers.get(source)
  if (!parse) throw new TypeError(`Unknown event source: ${source}`)
  return parse(raw)
}
