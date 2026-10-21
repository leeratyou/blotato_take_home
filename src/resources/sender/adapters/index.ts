import type { SendReceipt } from '@/domain/deliveries'
import type { AnswerEvent } from '@/domain/events'
import { sendInstagram } from '@/resources/sender/adapters/instagram'

export type OutboundTransport = (source: string, accountId: string, payload: unknown) => Promise<unknown>

const adapters = new Map<string, (answer: AnswerEvent, transport: OutboundTransport) => Promise<SendReceipt>>([
  ['instagram', sendInstagram],
])

export async function sendOutbound(answer: AnswerEvent, transport: OutboundTransport): Promise<SendReceipt> {
  const send = adapters.get(answer.source)
  if (!send) throw new TypeError(`Unknown event source: ${answer.source}`)
  return send(answer, transport)
}
