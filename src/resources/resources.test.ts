import assert from 'node:assert/strict'
import test from 'node:test'
import { fastifyAwilixPlugin } from '@fastify/awilix'
import Fastify from 'fastify'
import type { AnswerEvent, BusEvent, SendingConfirmEvent } from '@/domain/events'
import resources from '@/resources'
import { generateAnswerHandler } from '@/resources/answering_engine'
import { receiveEventHandler } from '@/resources/receiver'
import { sendAnswerHandler } from '@/resources/sender'
import { buildContainer } from '@/services/di_container'

test('resources use shared port bindings and unsubscribe their handlers without an HTTP listener', async t => {
  const app = Fastify()
  t.after(() => app.close())
  const container = buildContainer(app.log)
  const { eventBus, eventPublisher, outerReceiver } = container.cradle
  assert.equal(eventPublisher, eventBus)

  const busSubscribe = t.mock.method(eventBus, 'subscribe')
  const busUnsubscribe = t.mock.method(eventBus, 'unsubscribe')
  const outerSubscribe = t.mock.method(outerReceiver, 'subscribe')
  const outerUnsubscribe = t.mock.method(outerReceiver, 'unsubscribe')

  await app.register(fastifyAwilixPlugin, { container })
  await app.register(resources)
  await app.ready()

  assert.equal(app.server.listening, false)
  assert.deepEqual(busSubscribe.mock.calls.map(call => call.arguments[0]), ['comment_received', 'dm_message', 'answer', 'sending_confirm'])
  assert.equal(outerSubscribe.mock.callCount(), 1)
  const subscriptions = new Map(busSubscribe.mock.calls.map(call => call.arguments))

  await app.close()

  assert.deepEqual(busUnsubscribe.mock.calls.map(call => call.arguments[0]).sort(), ['answer', 'comment_received', 'dm_message', 'sending_confirm'])
  for (const { arguments: [type, handler] } of busUnsubscribe.mock.calls) {
    assert.equal(handler, subscriptions.get(type))
  }
  assert.equal(outerUnsubscribe.mock.callCount(), 1)
  assert.equal(outerUnsubscribe.mock.calls[0]?.arguments[0], outerSubscribe.mock.calls[0]?.arguments[0])
})

test('answering handler rejects send confirmations before publishing an answer', async t => {
  const app = Fastify()
  t.after(() => app.close())
  const container = buildContainer(app.log)
  const publish = t.mock.method(container.cradle.eventBus, 'send', async () => {})
  const errors = t.mock.method(app.log, 'error')
  await app.register(fastifyAwilixPlugin, { container })
  await app.ready()
  const confirmation: SendingConfirmEvent = {
    id: 'instagram:sending_confirm:mid-1',
    type: 'sending_confirm',
    source: 'instagram',
    accountId: 'acct-1',
    participantId: 'user-1',
    externalId: 'mid-1',
    conversationId: 'instagram:acct-1:user-1',
    occurredAt: '2026-10-21T00:00:00.000Z',
    text: 'pricing',
  }

  await assert.rejects(generateAnswerHandler(app)(confirmation), TypeError)

  assert.equal(publish.mock.callCount(), 0)
  assert.equal(errors.mock.callCount(), 1)
})

test('sender subscriptions dispatch answers and track confirmations without sending again', async t => {
  const app = Fastify()
  t.after(() => app.close())
  const container = buildContainer(app.log)
  const { eventBus, outerSender, deliveryStore } = container.cradle
  const subscriptions = t.mock.method(eventBus, 'subscribe')
  const published: BusEvent[] = []
  t.mock.method(eventBus, 'send', async (event: BusEvent) => { published.push(event) })
  const dispatch = t.mock.method(outerSender, 'send', async () => ({ message_id: 'sent-1' }))
  await app.register(fastifyAwilixPlugin, { container })
  await app.register(resources)
  await app.ready()
  const handlers = new Map(subscriptions.mock.calls.map(call => call.arguments))
  const answer: AnswerEvent = {
    id: 'answer:instagram:dm_message:mid-1',
    type: 'answer',
    source: 'instagram',
    accountId: 'acct-1',
    participantId: 'user-1',
    conversationId: 'opaque-conversation',
    replyTo: { type: 'dm_message', externalId: 'mid-1' },
    payload: { text: 'Reply' },
  }

  await handlers.get('answer')!(answer)
  assert.deepEqual(dispatch.mock.calls.map(call => call.arguments), [[
    'instagram', 'acct-1', { recipient: { id: 'user-1' }, message: { text: 'Reply' } },
  ]])
  assert.deepEqual(published, [{
    id: `send:${answer.id}`,
    type: 'send',
    source: 'instagram',
    accountId: 'acct-1',
    participantId: 'user-1',
    conversationId: 'opaque-conversation',
    externalId: 'sent-1',
    payload: { answerId: answer.id },
  }])

  const confirmation: SendingConfirmEvent = {
    id: 'instagram:sending_confirm:sent-1',
    type: 'sending_confirm',
    source: 'instagram',
    accountId: 'acct-1',
    participantId: 'user-1',
    conversationId: 'opaque-conversation',
    externalId: 'sent-1',
    occurredAt: '2026-10-21T00:00:00.000Z',
    text: 'Reply',
  }
  await handlers.get('sending_confirm')!(confirmation)

  assert.equal(dispatch.mock.callCount(), 1)
  assert.equal(published.length, 1)
  assert.equal((await deliveryStore.findByAnswerId(answer.id))?.status, 'confirmed')
})

test('sender rejects unrelated events and logs dispatch failures once', async t => {
  const app = Fastify()
  t.after(() => app.close())
  const container = buildContainer(app.log)
  const errors = t.mock.method(app.log, 'error')
  const publish = t.mock.method(container.cradle.eventBus, 'send', async () => {})
  const dispatch = t.mock.method(container.cradle.outerSender, 'send', async () => { throw new Error('provider unavailable') })
  await app.register(fastifyAwilixPlugin, { container })
  await app.ready()
  const handler = sendAnswerHandler(app)
  const answer: AnswerEvent = {
    id: 'answer:1',
    type: 'answer',
    source: 'instagram',
    accountId: 'acct-1',
    participantId: 'user-1',
    conversationId: 'opaque-conversation',
    replyTo: { type: 'dm_message', externalId: 'mid-1' },
    payload: { text: 'Reply' },
  }
  await assert.rejects(handler({ ...answer, type: 'send', externalId: 'sent-1', payload: { answerId: answer.id } }), TypeError)
  assert.equal(dispatch.mock.callCount(), 0)
  await assert.rejects(handler(answer), { message: 'provider unavailable' })
  assert.equal(errors.mock.callCount(), 2)
  assert.equal(dispatch.mock.callCount(), 1)
  assert.equal(publish.mock.callCount(), 0)
})

test('receiver rejects unusable bodies, drops malformed items, and logs each failure once', async t => {
  const app = Fastify()
  t.after(() => app.close())
  const container = buildContainer(app.log)
  const errors = t.mock.method(app.log, 'error')
  await app.register(fastifyAwilixPlugin, { container })
  await app.register(resources)
  await app.ready()
  const handler = receiveEventHandler(app)
  const unusable: [string, unknown][] = [
    ['unknown', { object: 'instagram', entry: [] }],
    ['instagram', undefined],
    ['instagram', null],
    ['instagram', []],
    ['instagram', 'event'],
    ['instagram', {}],
  ]

  for (const [index, [source, raw]] of unusable.entries()) {
    await assert.rejects(handler(source, raw), TypeError)
    assert.equal(errors.mock.callCount(), index + 1)
  }

  // Malformed items are logged and dropped without failing the webhook.
  await handler('instagram', { object: 'instagram', entry: [{ id: ' ' }, { time: 1 }] })
  assert.equal(errors.mock.callCount(), unusable.length + 2)

  // A failed publish releases the key, so the provider's retry reaches the bus again.
  const comment = { field: 'comments', value: { id: 'c-1', text: 'pricing', from: { id: 'user-1' } } }
  const webhook = { object: 'instagram', entry: [{ id: 'acct-1', time: 1, changes: [comment] }] }
  for (const attempt of [1, 2]) {
    await assert.rejects(handler('instagram', webhook), (err: unknown) => {
      assert.ok(err instanceof AggregateError)
      assert.deepEqual(err.errors.map(e => e.message), ['EventBus.send is not implemented'])
      return true
    })
    assert.equal(errors.mock.callCount(), unusable.length + 2 + attempt)
  }
})
