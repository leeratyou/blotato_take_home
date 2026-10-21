import assert from 'node:assert/strict'
import test from 'node:test'
import { fastifyAwilixPlugin } from '@fastify/awilix'
import Fastify from 'fastify'
import resources from '@/resources'
import { receiveEventHandler } from '@/resources/receiver'
import { buildContainer } from '@/services/di_container'

test('resources use shared port bindings and unsubscribe their handlers without an HTTP listener', async t => {
  const app = Fastify()
  t.after(() => app.close())
  const container = buildContainer(app.log)
  const { eventBus, eventPublisher, outerReceiver, outerSender, messageSender } = container.cradle
  assert.equal(eventPublisher, eventBus)
  assert.equal(messageSender, outerSender)

  const busSubscribe = t.mock.method(eventBus, 'subscribe')
  const busUnsubscribe = t.mock.method(eventBus, 'unsubscribe')
  const outerSubscribe = t.mock.method(outerReceiver, 'subscribe')
  const outerUnsubscribe = t.mock.method(outerReceiver, 'unsubscribe')

  await app.register(fastifyAwilixPlugin, { container })
  await app.register(resources)
  await app.ready()

  assert.equal(app.server.listening, false)
  assert.deepEqual(busSubscribe.mock.calls.map(call => call.arguments[0]), ['new', 'answer'])
  assert.equal(outerSubscribe.mock.callCount(), 1)
  const subscriptions = new Map(busSubscribe.mock.calls.map(call => call.arguments))

  await app.close()

  assert.deepEqual(busUnsubscribe.mock.calls.map(call => call.arguments[0]).sort(), ['answer', 'new'])
  for (const { arguments: [type, handler] } of busUnsubscribe.mock.calls) {
    assert.equal(handler, subscriptions.get(type))
  }
  assert.equal(outerUnsubscribe.mock.callCount(), 1)
  assert.equal(outerUnsubscribe.mock.calls[0]?.arguments[0], outerSubscribe.mock.calls[0]?.arguments[0])
})

test('receiver validates external envelopes and logs each failure once', async t => {
  const app = Fastify()
  t.after(() => app.close())
  const container = buildContainer(app.log)
  const errors = t.mock.method(app.log, 'error')
  await app.register(fastifyAwilixPlugin, { container })
  await app.register(resources)
  await app.ready()
  const handler = receiveEventHandler(app)
  const malformed = [
    undefined,
    null,
    [],
    'event',
    {},
    { id: 1, payload: null },
    { id: ' ', payload: null },
    { id: 'event-1' },
  ]

  for (const [index, event] of malformed.entries()) {
    await assert.rejects(handler(event), TypeError)
    assert.equal(errors.mock.callCount(), index + 1)
  }

  await assert.rejects(handler({ id: 'event-1', payload: null }), {
    name: 'Error',
    message: 'receiveEvent is not implemented',
  })
  assert.equal(errors.mock.callCount(), malformed.length + 1)
})
