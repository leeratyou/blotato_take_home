import type { InboundEvent } from '@/domain/events'
import type { ParseResult } from '@/resources/receiver/adapters'

// Instagram webhook payload: { object: 'instagram', entry: [{ id, time, changes?, messaging? }] }.
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

function event(
  kind: InboundEvent['kind'],
  externalId: string,
  accountId: string,
  participantId: string,
  occurredAt: string,
  body: string,
): InboundEvent {
  return {
    id: `${source}:${kind}:${externalId}`,
    source,
    kind,
    externalId,
    // Assumes comment authors and message senders share one account-scoped id (see RESEARCH.md, identity).
    conversationId: `${source}:${accountId}:${participantId}`,
    occurredAt,
    text: body,
  }
}

function parseComment(item: unknown, accountId: string, entry: Json, entryPath: string, path: string): InboundEvent[] {
  const change = object(item, path)
  if (change.field !== 'comments') return []

  const value = object(change.value, `${path}.value`)
  const authorId = id(object(value.from, `${path}.value.from`).id, `${path}.value.from.id`)
  if (authorId === accountId) return [] // Own reply; the payload lacks the participant, so it cannot be a sending_confirm

  return [
    event(
      'comment_received',
      id(value.id, `${path}.value.id`),
      accountId,
      authorId,
      time(entry.time, `${entryPath}.time`),
      text(value.text, `${path}.value.text`),
    ),
  ]
}

function parseMessage(item: unknown, accountId: string, path: string): InboundEvent[] {
  const messaging = object(item, path)
  if (messaging.message === undefined) return [] // Read receipts, reactions, postbacks

  const message = object(messaging.message, `${path}.message`)
  if (message.is_deleted === true) return [] // Deletion notice

  // An echo is the account's own sent message, so the participant is its recipient.
  const echo = message.is_echo === true
  const participant = echo ? 'recipient' : 'sender'

  return [
    event(
      echo ? 'sending_confirm' : 'dm_message',
      id(message.mid, `${path}.message.mid`),
      accountId,
      id(object(messaging[participant], `${path}.${participant}`).id, `${path}.${participant}.id`),
      time(messaging.timestamp, `${path}.timestamp`),
      text(message.text, `${path}.message.text`),
    ),
  ]
}

// An unusable body throws; a malformed entry or item is collected so the rest of the batch survives.
export function parseInstagram(raw: unknown): ParseResult {
  const body = object(raw, 'body')
  if (body.object !== 'instagram') throw new TypeError('Expected an instagram webhook')

  const result: ParseResult = { events: [], errors: [] }
  const collect = (parse: () => InboundEvent[]) => {
    try {
      result.events.push(...parse())
    } catch (err) {
      result.errors.push(err)
    }
  }

  list(body.entry, 'entry').forEach((item, i) =>
    collect(() => {
      const entry = object(item, `entry[${i}]`)
      const accountId = id(entry.id, `entry[${i}].id`)
      list(entry.changes, `entry[${i}].changes`).forEach((change, j) =>
        collect(() => parseComment(change, accountId, entry, `entry[${i}]`, `entry[${i}].changes[${j}]`)),
      )
      list(entry.messaging, `entry[${i}].messaging`).forEach((messaging, j) =>
        collect(() => parseMessage(messaging, accountId, `entry[${i}].messaging[${j}]`)),
      )
      return []
    }),
  )

  return result
}
