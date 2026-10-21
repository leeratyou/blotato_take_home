// Normalized inbound event; every source adapter produces this shape.
export type InboundEvent = {
  id: string // Idempotency key: `${source}:${kind}:${externalId}`
  source: string
  // comment_received: a participant's comment on the account's media
  // dm_message: a participant's direct message
  // sending_confirm: provider echo of a message this account sent
  kind: 'comment_received' | 'dm_message' | 'sending_confirm'
  externalId: string // Provider id of the comment or message; reply target
  conversationId: string // Account-scoped participant; answering-engine context and bus partition key
  occurredAt: string // Provider time, ISO 8601; used only for ordering
  text: string
}

type InboundPayload = Omit<InboundEvent, 'kind'>
export type CommentReceivedEvent = InboundPayload & { type: 'comment_received' }
export type DmMessageEvent = InboundPayload & { type: 'dm_message' }
export type SendingConfirmEvent = InboundPayload & { type: 'sending_confirm' }

// Payload is a placeholder until Answer and Send schemas are defined.
// conversationId is the bus partition key, shared by every event of one conversation.
type Envelope = { id: string; conversationId: string; payload: unknown }
export type AnswerEvent = Envelope & { type: 'answer' }
export type SendEvent = Envelope & { type: 'send' }

export type BusEvent = CommentReceivedEvent | DmMessageEvent | SendingConfirmEvent | AnswerEvent | SendEvent
