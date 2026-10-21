import assert from 'node:assert/strict'
import test from 'node:test'
import { MemoryIdempotencyStore } from '@/services/memory_idempotency_store'

test('memory idempotency store claims once, releases, and expires keys after seven days', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 0 })
  const store = new MemoryIdempotencyStore()
  const week = 7 * 24 * 60 * 60 * 1000

  assert.equal(await store.claim('a'), true)
  assert.equal(await store.claim('a'), false)
  await store.release('a')
  assert.equal(await store.claim('a'), true)

  t.mock.timers.tick(week - 1)
  assert.equal(await store.claim('b'), true)
  assert.equal(await store.claim('a'), false)

  t.mock.timers.tick(1)
  assert.equal(await store.claim('a'), true)
  assert.equal(await store.claim('b'), false)
})
