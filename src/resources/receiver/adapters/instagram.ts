import type { InboundEvent } from '@/domain/events'

// Instagram webhook payload: { object: 'instagram', entry: [{ id, time, changes?, messaging? }] }.
// Only inbound comments and messages are normalized; other fields and own echoes are skipped.

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
  if (authorId === accountId) return [] // Own reply

  return [
    event(
      'comment',
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
  if (message.is_echo === true || message.is_deleted === true) return [] // Own outgoing copy or deletion notice

  return [
    event(
      'message',
      id(message.mid, `${path}.message.mid`),
      accountId,
      id(object(messaging.sender, `${path}.sender`).id, `${path}.sender.id`),
      time(messaging.timestamp, `${path}.timestamp`),
      text(message.text, `${path}.message.text`),
    ),
  ]
}

export function parseInstagram(raw: unknown): InboundEvent[] {
  const body = object(raw, 'body')
  if (body.object !== 'instagram') throw new TypeError('Expected an instagram webhook')

  return list(body.entry, 'entry').flatMap((item, i) => {
    const entry = object(item, `entry[${i}]`)
    const accountId = id(entry.id, `entry[${i}].id`)

    return [
      ...list(entry.changes, `entry[${i}].changes`).flatMap((change, j) =>
        parseComment(change, accountId, entry, `entry[${i}]`, `entry[${i}].changes[${j}]`),
      ),
      ...list(entry.messaging, `entry[${i}].messaging`).flatMap((messaging, j) =>
        parseMessage(messaging, accountId, `entry[${i}].messaging[${j}]`),
      ),
    ]
  })
}
