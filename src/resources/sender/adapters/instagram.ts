import type { SendReceipt } from '@/domain/deliveries'
import type { AnswerEvent } from '@/domain/events'
import type { OutboundTransport } from '@/resources/sender/adapters'

function nonEmpty(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Expected ${name} to be a non-empty string`)
  }
  return value
}

export async function sendInstagram(answer: AnswerEvent, transport: OutboundTransport): Promise<SendReceipt> {
  const accountId = nonEmpty(answer.accountId, 'accountId')
  const text = nonEmpty(answer.payload.text, 'reply text')
  let recipient: { comment_id: string } | { id: string }
  switch (answer.replyTo.type) {
    case 'comment_received':
      recipient = { comment_id: nonEmpty(answer.replyTo.externalId, 'comment id') }
      break
    case 'dm_message':
      recipient = { id: nonEmpty(answer.participantId, 'participantId') }
      break
    default:
      throw new TypeError('Expected a comment_received or dm_message reply target')
  }

  const response = await transport('instagram', accountId, { recipient, message: { text } })
  if (typeof response !== 'object' || response === null || Array.isArray(response) || !('message_id' in response)) {
    throw new TypeError('Expected an Instagram send receipt with message_id')
  }
  return { externalId: nonEmpty(response.message_id, 'message_id') }
}
