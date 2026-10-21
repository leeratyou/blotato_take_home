import assert from 'node:assert/strict'
import test from 'node:test'
import type { BusEvent, InboundEvent } from '@/domain/events'
import type { EventPublisher, IdempotencyStore } from '@/domain/ports'
import { receiveEvent, receiveEvents } from '@/resources/receiver/receiver.usecases'

const event: InboundEvent = {
  id: 'instagram:comment_received:c-1',
  source: 'instagram',
  kind: 'comment_received',
  externalId: 'c-1',
  conversationId: 'instagram:acct-1:user-1',
  occurredAt: '2023-11-14T22:13:20.000Z',
  text: 'pricing',
}

function fakeStore(): IdempotencyStore {
  const keys = new Set<string>()
  return {
    async claim(key) {
      if (keys.has(key)) return false
      keys.add(key)
      return true
    },
    async release(key) {
      keys.delete(key)
    },
  }
}

test('receiveEvent publishes a New event once per idempotency key', async () => {
  const published: BusEvent[] = []
  const publisher: EventPublisher = { send: async e => void published.push(e) }

  const ports = { publisher, idempotency: fakeStore() }

  await receiveEvent(ports, event)
  await receiveEvent(ports, event)

  assert.deepEqual(published, [{ ...event, type: 'new' }])
})

test('receiveEvent releases the key when publishing fails, so a retry is not dropped', async () => {
  const published: BusEvent[] = []
  let fail = true
  const publisher: EventPublisher = {
    async send(e) {
      if (fail) throw new Error('bus down')
      published.push(e)
    },
  }
  const ports = { publisher, idempotency: fakeStore() }

  await assert.rejects(receiveEvent(ports, event), { message: 'bus down' })
  fail = false
  await receiveEvent(ports, event)

  assert.deepEqual(published, [{ ...event, type: 'new' }])
})

test('receiveEvents processes every event and reports failures together', async () => {
  const published: string[] = []
  const rejected = new Set(['instagram:dm_message:m-2'])
  const publisher: EventPublisher = {
    async send(e) {
      if (rejected.has(e.id)) throw new Error(`bus rejected ${e.id}`)
      published.push(e.id)
    },
  }
  const ports = { publisher, idempotency: fakeStore() }
  const batch: InboundEvent[] = ['m-1', 'm-2', 'm-3'].map(mid => ({
    ...event,
    id: `instagram:dm_message:${mid}`,
    kind: 'dm_message',
    externalId: mid,
  }))

  await assert.rejects(receiveEvents(ports, batch), (err: unknown) => {
    assert.ok(err instanceof AggregateError)
    assert.equal(err.message, '1/3 inbound events failed')
    assert.deepEqual(err.errors.map(e => e.message), ['bus rejected instagram:dm_message:m-2'])
    return true
  })
  assert.deepEqual(published, ['instagram:dm_message:m-1', 'instagram:dm_message:m-3'])

  // Provider retries the whole batch; only the failed event is published again.
  rejected.clear()
  await receiveEvents(ports, batch)
  assert.deepEqual(published, ['instagram:dm_message:m-1', 'instagram:dm_message:m-3', 'instagram:dm_message:m-2'])
})
