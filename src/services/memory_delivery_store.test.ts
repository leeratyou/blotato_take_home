import assert from 'node:assert/strict'
import test from 'node:test'
import type { SentDelivery } from '@/domain/deliveries'
import type { SendingConfirmEvent } from '@/domain/events'
import { MemoryDeliveryStore } from '@/services/memory_delivery_store'

const sent: SentDelivery = {
  answerId: 'answer-1',
  source: 'instagram',
  accountId: 'acct-1',
  participantId: 'user-1',
  conversationId: 'opaque-conversation',
  externalId: 'out-1',
}
const confirmation: SendingConfirmEvent = {
  id: 'instagram:sending_confirm:out-1',
  type: 'sending_confirm',
  source: sent.source,
  accountId: sent.accountId,
  participantId: sent.participantId,
  conversationId: sent.conversationId,
  externalId: sent.externalId,
  occurredAt: '2026-10-21T00:00:00.000Z',
  text: 'Reply',
}

test('an early confirmation survives recordSent and gains answer correlation', async () => {
  const store = new MemoryDeliveryStore()
  await store.confirm(confirmation)

  assert.equal(await store.findByAnswerId(sent.answerId), undefined)
  assert.deepEqual(await store.get(sent), {
    source: sent.source,
    accountId: sent.accountId,
    participantId: sent.participantId,
    conversationId: sent.conversationId,
    externalId: sent.externalId,
    status: 'confirmed',
    confirmedAt: confirmation.occurredAt,
  })

  await store.recordSent(sent)
  assert.deepEqual(await store.get(sent), {
    ...sent,
    status: 'confirmed',
    confirmedAt: confirmation.occurredAt,
  })
  assert.equal((await store.findByAnswerId(sent.answerId))?.externalId, sent.externalId)
})

test('confirmation advances sent state once and returned snapshots cannot mutate it', async () => {
  const store = new MemoryDeliveryStore()
  assert.equal(await store.get(sent), undefined)
  await store.recordSent(sent)
  assert.deepEqual(await store.get(sent), { ...sent, status: 'sent' })

  await store.confirm(confirmation)
  await store.confirm({ ...confirmation, occurredAt: '2026-10-21T00:01:00.000Z' })
  const expected = { ...sent, status: 'confirmed', confirmedAt: confirmation.occurredAt }
  assert.deepEqual(await store.get(sent), expected)

  const snapshot = await store.get(sent)
  assert.ok(snapshot)
  snapshot.status = 'sent'
  snapshot.participantId = 'changed'
  const byAnswer = await store.findByAnswerId(sent.answerId)
  assert.ok(byAnswer)
  byAnswer.externalId = 'changed'
  assert.deepEqual(await store.get(sent), expected)
  assert.equal((await store.findByAnswerId(sent.answerId))?.externalId, sent.externalId)
})

test('source and account isolate records with the same provider externalId', async () => {
  const store = new MemoryDeliveryStore()
  const otherAccount = { ...sent, accountId: 'acct-2', answerId: 'answer-2' }
  const otherSource = { ...sent, source: 'other', answerId: 'answer-3' }
  for (const delivery of [sent, otherAccount, otherSource]) await store.recordSent(delivery)
  await store.confirm(confirmation)

  assert.equal((await store.get(sent))?.status, 'confirmed')
  for (const delivery of [otherAccount, otherSource]) {
    assert.deepEqual(await store.get(delivery), { ...delivery, status: 'sent' })
    assert.deepEqual(await store.findByAnswerId(delivery.answerId), { ...delivery, status: 'sent' })
  }
})
