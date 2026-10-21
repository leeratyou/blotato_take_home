import assert from 'node:assert/strict'
import test from 'node:test'
import type { AnswerEvent, BusEvent, SendingConfirmEvent } from '@/domain/events'
import { confirmSending, createAnswerSender, sendAnswer } from '@/resources/sender/sender.usecases'
import { MemoryDeliveryStore } from '@/services/memory_delivery_store'

const answer: AnswerEvent = {
  id: 'answer:instagram:dm_message:in-1',
  type: 'answer',
  source: 'instagram',
  accountId: 'acct-1',
  participantId: 'user-1',
  conversationId: 'opaque-conversation',
  replyTo: { type: 'dm_message', externalId: 'in-1' },
  payload: { text: 'Reply' },
}

function deferred() {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

test('sendAnswer saves the accepted receipt before publication and confirmSending confirms it', async () => {
  const deliveries = new MemoryDeliveryStore()
  const calls: string[] = []
  const published: BusEvent[] = []

  await sendAnswer({
    deliveries,
    sender: {
      async send(event) {
        assert.deepEqual(event, answer)
        calls.push('send')
        return { externalId: 'out-1' }
      },
    },
    publisher: {
      async send(event) {
        assert.equal((await deliveries.findByAnswerId(answer.id))?.externalId, 'out-1')
        calls.push('publish')
        published.push(event)
      },
    },
  }, answer)

  assert.deepEqual(calls, ['send', 'publish'])
  assert.deepEqual(published, [{
    id: `send:${answer.id}`,
    type: 'send',
    source: answer.source,
    accountId: answer.accountId,
    participantId: answer.participantId,
    conversationId: answer.conversationId,
    externalId: 'out-1',
    payload: { answerId: answer.id },
  }])

  const confirmation: SendingConfirmEvent = {
    id: 'instagram:sending_confirm:out-1',
    type: 'sending_confirm',
    source: answer.source,
    accountId: answer.accountId,
    participantId: answer.participantId,
    conversationId: answer.conversationId,
    externalId: 'out-1',
    occurredAt: '2026-10-21T00:00:00.000Z',
    text: answer.payload.text,
  }
  await confirmSending({ deliveries }, confirmation)
  assert.equal((await deliveries.get(confirmation))?.status, 'confirmed')
})

test('provider rejection records no delivery and publishes no send event', async () => {
  const deliveries = new MemoryDeliveryStore()
  let published = false
  await assert.rejects(sendAnswer({
    deliveries,
    sender: { send: async () => { throw new Error('provider rejected') } },
    publisher: { send: async () => { published = true } },
  }, answer), { message: 'provider rejected' })

  assert.equal(await deliveries.findByAnswerId(answer.id), undefined)
  assert.equal(published, false)
})

test('retry after publication failure reuses the persisted receipt without sending again', async () => {
  const deliveries = new MemoryDeliveryStore()
  let sends = 0
  const published: BusEvent[] = []
  const ports = {
    deliveries,
    sender: { send: async () => { sends++; return { externalId: 'out-1' } } },
    publisher: {
      async send(event: BusEvent) {
        published.push(event)
        if (published.length === 1) throw new Error('bus down')
      },
    },
  }

  await assert.rejects(sendAnswer(ports, answer), { message: 'bus down' })
  await sendAnswer(ports, answer)

  assert.equal(sends, 1)
  assert.equal(published.length, 2)
  assert.deepEqual(published[1], published[0])
})

test('a known answer publishes its stored dispatch without resending it', async () => {
  const deliveries = new MemoryDeliveryStore()
  await deliveries.recordSent({
    answerId: answer.id,
    source: answer.source,
    accountId: answer.accountId,
    participantId: answer.participantId,
    conversationId: answer.conversationId,
    externalId: 'out-1',
  })
  const published: BusEvent[] = []
  const ports = {
    deliveries,
    sender: { send: async () => { throw new Error('must not resend') } },
    publisher: { send: async (event: BusEvent) => { published.push(event) } },
  }

  await sendAnswer(ports, answer)
  await sendAnswer(ports, answer)

  assert.equal(published.length, 2)
  assert.deepEqual(published[1], published[0])
  assert.equal(published[0]?.type, 'send')
})

test('concurrent duplicates wait for one dispatch, receipt write, and publication', async () => {
  const store = new MemoryDeliveryStore()
  const writing = deferred()
  const release = deferred()
  let sends = 0
  let records = 0
  const published: BusEvent[] = []
  const send = createAnswerSender({
    deliveries: {
      findByAnswerId: id => store.findByAnswerId(id),
      confirm: event => store.confirm(event),
      async recordSent(delivery) {
        records++
        writing.resolve()
        await release.promise
        await store.recordSent(delivery)
      },
    },
    sender: { send: async () => { sends++; return { externalId: 'out-1' } } },
    publisher: { send: async event => { published.push(event) } },
  })
  let firstDone = false
  let duplicateDone = false
  const first = send(answer).then(() => { firstDone = true })
  await writing.promise
  const duplicate = send(answer).then(() => { duplicateDone = true })
  await Promise.resolve()

  assert.equal(sends, 1)
  assert.equal(records, 1)
  assert.equal(firstDone, false)
  assert.equal(duplicateDone, false)
  assert.equal(published.length, 0)
  assert.equal(await store.findByAnswerId(answer.id), undefined)

  release.resolve()
  await Promise.all([first, duplicate])
  assert.equal(sends, 1)
  assert.equal(records, 1)
  assert.equal(published.length, 1)
  assert.equal((await store.findByAnswerId(answer.id))?.externalId, 'out-1')
})

test('a failed shared publication clears pending work so a later retry can publish', async () => {
  const deliveries = new MemoryDeliveryStore()
  const publishing = deferred()
  const release = deferred()
  let sends = 0
  let publications = 0
  const send = createAnswerSender({
    deliveries,
    sender: { send: async () => { sends++; return { externalId: 'out-1' } } },
    publisher: {
      async send() {
        publications++
        if (publications === 1) {
          publishing.resolve()
          await release.promise
        }
      },
    },
  })
  const first = send(answer)
  await publishing.promise
  const duplicate = send(answer)
  const results = Promise.allSettled([first, duplicate])
  const error = new Error('bus down')
  release.reject(error)

  assert.deepEqual(await results, [
    { status: 'rejected', reason: error },
    { status: 'rejected', reason: error },
  ])
  assert.equal(publications, 1)
  await send(answer)

  assert.equal(sends, 1)
  assert.equal(publications, 2)
})
