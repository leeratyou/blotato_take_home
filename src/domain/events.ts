// Normalized inbound event; every source adapter produces this shape.
export type InboundEvent = {
  id: string // Idempotency key: `${source}:${kind}:${externalId}`
  source: string
  // comment_received: a participant's comment on the account's media
  // dm_message: a participant's direct message
  // sending_confirm: provider echo of a message this account sent
  kind: 'comment_received' | 'dm_message' | 'sending_confirm'
  externalId: string // Provider id of the comment or message; reply target
  conversationId: string // Account-scoped participant; used only by the answering engine
  occurredAt: string // Provider time, ISO 8601; used only for ordering
  text: string
}

export type NewEvent = InboundEvent & { type: 'new' }

// Placeholder until Answer and Send schemas are defined.
type Envelope = { id: string; payload: unknown }
export type AnswerEvent = Envelope & { type: 'answer' }
export type SendEvent = Envelope & { type: 'send' }

export type BusEvent = NewEvent | AnswerEvent | SendEvent
