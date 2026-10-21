import assert from 'node:assert/strict'
import test from 'node:test'
import type { BusEvent, InboundEvent } from '@/domain/events'
import type { EventPublisher, IdempotencyStore } from '@/domain/ports'
import { receiveEvent } from '@/resources/receiver/receiver.usecases'

const event: InboundEvent = {
  id: 'instagram:comment:c-1',
  source: 'instagram',
  kind: 'comment',
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
  const store = fakeStore()

  await receiveEvent(publisher, store, event)
  await receiveEvent(publisher, store, event)

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
  const store = fakeStore()

  await assert.rejects(receiveEvent(publisher, store, event), { message: 'bus down' })
  fail = false
  await receiveEvent(publisher, store, event)

  assert.deepEqual(published, [{ ...event, type: 'new' }])
})
