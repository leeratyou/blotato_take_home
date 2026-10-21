import type { InboundEvent } from '@/domain/events'
import type { ParseResult } from '@/resources/receiver/adapters'

// Spec: https://developers.facebook.com/documentation/instagram-platform/webhooks/examples
type InstagramComment = { id: string; from: { id: string }; text?: string }
type InstagramChange = { field: string; value: unknown }
type InstagramMessaging = {
  sender: { id: string }
  recipient: { id: string }
  timestamp: number
  message?: { mid: string; text?: string; is_echo?: boolean; is_deleted?: boolean }
}
type InstagramEntry = {
  id: string
  time: number
  changes?: InstagramChange[]
  messaging?: InstagramMessaging[]
}
export type InstagramWebhook = { object: 'instagram'; entry: InstagramEntry[] }

const source = 'instagram'

function time(timestamp: number): string {
  // Provider timestamps can use seconds or milliseconds.
  return new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp).toISOString()
}

function createEvent(input: Omit<InboundEvent, 'id' | 'source' | 'conversationId'>): InboundEvent {
  return {
    ...input,
    id: `${source}:${input.type}:${input.externalId}`,
    source,
    // Assumes comment and DM participant IDs correspond; identity mapping is not implemented.
    conversationId: `${source}:${input.accountId}:${input.participantId}`,
  }
}

function parseComment(change: InstagramChange, entry: InstagramEntry): InboundEvent | undefined {
  if (change.field !== 'comments') return

  const comment = change.value as InstagramComment
  if (comment.from.id === entry.id) return // Ignore the account's own comments.

  return createEvent({
    type: 'comment_received',
    externalId: comment.id,
    accountId: entry.id,
    participantId: comment.from.id,
    occurredAt: time(entry.time),
    text: comment.text ?? '',
  })
}

function parseMessage(item: InstagramMessaging, accountId: string): InboundEvent | undefined {
  const { message } = item
  if (!message || message.is_deleted) return // Read receipts, reactions, and deletions.

  return createEvent({
    type: message.is_echo ? 'sending_confirm' : 'dm_message',
    externalId: message.mid,
    accountId,
    participantId: message.is_echo ? item.recipient.id : item.sender.id,
    occurredAt: time(item.timestamp),
    text: message.text ?? '', // Attachment-only messages have no text.
  })
}

function parseCollection<T>(
  items: T[] = [],
  parse: (item: T) => InboundEvent | undefined,
  result: ParseResult,
): void {
  try {
    for (const item of items) {
      try {
        const event = parse(item)
        if (event) result.events.push(event)
      } catch (err) {
        result.errors.push(err)
      }
    }
  } catch (err) {
    result.errors.push(err)
  }
}

// Payload fields follow the provider contract; native parsing failures are collected per item.
export function parseInstagram(body: InstagramWebhook): ParseResult {
  const result: ParseResult = { events: [], errors: [] }
  for (const entry of body.entry) {
    try {
      parseCollection(entry.changes, change => parseComment(change, entry), result)
      parseCollection(entry.messaging, message => parseMessage(message, entry.id), result)
    } catch (err) {
      result.errors.push(err)
    }
  }

  return result
}
