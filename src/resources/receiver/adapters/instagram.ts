import type { InboundEvent } from '@/domain/events'
import type { ParseResult } from '@/resources/receiver/adapters'

// Instagram webhook payload: { object: 'instagram', entry: [{ id, time, changes?, messaging? }] }.
// Spec: https://developers.facebook.com/documentation/instagram-platform/webhooks/examples
// Normalizes participant comments and DMs, plus message echoes as send confirmations; other fields are skipped.

const source = 'instagram'

type Json = Record<string, unknown>

function object(value: unknown, path: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`Expected ${path} to be an object`)
  }
  return value as Json
}

function list(value: unknown, path: string): unknown[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new TypeError(`Expected ${path} to be an array`)
  return value
}

function id(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Expected ${path} to be a non-empty string`)
  }
  return value
}

function text(value: unknown, path: string): string {
  if (value === undefined) return '' // Attachment-only message
  if (typeof value !== 'string') throw new TypeError(`Expected ${path} to be a string`)
  return value
}

// Meta uses seconds in some fields and milliseconds in others.
// 1e12 ms is in 2001 and 1e12 s is far in the future, so the threshold is unambiguous.
function time(value: unknown, path: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new TypeError(`Expected ${path} to be a positive timestamp`)
  }
  return new Date(value < 1e12 ? value * 1000 : value).toISOString()
}

function createEvent(input: Omit<InboundEvent, 'id' | 'source' | 'conversationId'>): InboundEvent {
  return {
    ...input,
    id: `${source}:${input.type}:${input.externalId}`,
    source,
    // Assumes a comment author's id equals their DM sender id. Unverified: Meta returns the recipient's
    // messaging id in the first private reply's response, and it may differ.
    conversationId: `${source}:${input.accountId}:${input.participantId}`,
  }
}

function parseComment(item: unknown, accountId: string, entry: Json, entryPath: string, path: string): InboundEvent | undefined {
  const change = object(item, path)
  if (change.field !== 'comments') return

  const value = object(change.value, `${path}.value`)
  const authorId = id(object(value.from, `${path}.value.from`).id, `${path}.value.from.id`)
  if (authorId === accountId) return // Own reply; the payload lacks the participant, so it cannot be a sending_confirm

  return createEvent({
    type: 'comment_received',
    externalId: id(value.id, `${path}.value.id`),
    accountId,
    participantId: authorId,
    occurredAt: time(entry.time, `${entryPath}.time`),
    text: text(value.text, `${path}.value.text`),
  })
}

function parseMessage(item: unknown, accountId: string, path: string): InboundEvent | undefined {
  const messaging = object(item, path)
  if (messaging.message === undefined) return // Read receipts, reactions, postbacks

  const message = object(messaging.message, `${path}.message`)
  if (message.is_deleted === true) return // Deletion notice

  // An echo is the account's own sent message, so the participant is its recipient.
  const echo = message.is_echo === true
  const participant = echo ? 'recipient' : 'sender'

  return createEvent({
    type: echo ? 'sending_confirm' : 'dm_message',
    externalId: id(message.mid, `${path}.message.mid`),
    accountId,
    participantId: id(object(messaging[participant], `${path}.${participant}`).id, `${path}.${participant}.id`),
    occurredAt: time(messaging.timestamp, `${path}.timestamp`),
    text: text(message.text, `${path}.message.text`),
  })
}

function parseCollection(
  value: unknown,
  path: string,
  parse: (item: unknown, path: string) => InboundEvent | undefined,
  result: ParseResult,
): void {
  try {
    for (const [index, item] of list(value, path).entries()) {
      try {
        const event = parse(item, `${path}[${index}]`)
        if (event) result.events.push(event)
      } catch (err) {
        result.errors.push(err)
      }
    }
  } catch (err) {
    result.errors.push(err)
  }
}

// An unusable body throws; a malformed entry or item is collected so the rest of the batch survives.
export function parseInstagram(raw: unknown): ParseResult {
  const body = object(raw, 'body')
  if (body.object !== 'instagram') throw new TypeError('Expected an instagram webhook')

  const result: ParseResult = { events: [], errors: [] }
  for (const [index, item] of list(body.entry, 'entry').entries()) {
    try {
      const entryPath = `entry[${index}]`
      const entry = object(item, entryPath)
      const accountId = id(entry.id, `${entryPath}.id`)

      parseCollection(
        entry.changes, `${entryPath}.changes`,
        (change, path) => parseComment(change, accountId, entry, entryPath, path),
        result
      )

      parseCollection(
        entry.messaging, `${entryPath}.messaging`,
        (message, path) => parseMessage(message, accountId, path),
        result
      )
    } catch (err) {
      result.errors.push(err)
    }
  }

  return result
}
