import type { InboundEvent } from '@/domain/events'
import { parseInstagram } from '@/resources/receiver/adapters/instagram'

// One parser per source. A webhook can batch several events, so parsers return a list.
const parsers = new Map<string, (raw: unknown) => InboundEvent[]>([['instagram', parseInstagram]])

export function parseInbound(source: string, raw: unknown): InboundEvent[] {
  const parse = parsers.get(source)
  if (!parse) throw new TypeError(`Unknown event source: ${source}`)
  return parse(raw)
}
