// Normalized inbound event; every source adapter produces this shape.
export type InboundEvent = {
  id: string // Idempotency key: `${source}:${kind}:${externalId}`
  source: string
  kind: 'comment' | 'message'
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
