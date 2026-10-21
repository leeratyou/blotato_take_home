import type { InboundEvent } from '@/domain/events'
import { parseInstagram } from '@/resources/receiver/adapters/instagram'

// A webhook can batch several events; malformed items are reported in `errors` instead of failing the batch.
export type ParseResult = { events: InboundEvent[]; errors: unknown[] }

// One parser per source.
const parsers = new Map<string, (raw: unknown) => ParseResult>([['instagram', parseInstagram]])

export function parseInbound(source: string, raw: unknown): ParseResult {
  const parse = parsers.get(source)
  if (!parse) throw new TypeError(`Unknown event source: ${source}`)
  return parse(raw)
}
