// Normalized inbound event; every source adapter produces this shape.
type InboundPayload = {
  id: string // Idempotency key: `${source}:${type}:${externalId}`
  source: string
  accountId: string
  participantId: string
  externalId: string // Provider id of the comment or message; reply target
  conversationId: string // Account-scoped participant; answering-engine context and bus partition key
  occurredAt: string // Provider time, ISO 8601; used only for ordering
  text: string
}

// A participant's comment on the account's media.
export type CommentReceivedEvent = InboundPayload & { type: 'comment_received' }
// A participant's direct message.
export type DmMessageEvent = InboundPayload & { type: 'dm_message' }
// Provider echo of a message this account sent.
export type SendingConfirmEvent = InboundPayload & { type: 'sending_confirm' }
export type InboundEvent = CommentReceivedEvent | DmMessageEvent | SendingConfirmEvent

// conversationId is the bus partition key, shared by every event of one conversation.
type OutboundRouting = {
  id: string
  conversationId: string
  source: string
  accountId: string
  participantId: string
}
export type AnswerEvent = OutboundRouting & {
  type: 'answer'
  replyTo: { type: 'comment_received' | 'dm_message'; externalId: string }
  payload: { text: string }
}
// The integration accepted the dispatch; a sending_confirm tracks delivery separately.
export type SendEvent = OutboundRouting & {
  type: 'send'
  externalId: string
  payload: { answerId: string }
}

export type BusEvent = InboundEvent | AnswerEvent | SendEvent
