import type { FastifyInstance } from 'fastify'
import type { IncomingEvent } from '@/domain/events'
import { receiveEvent } from '@/resources/receiver/receiver.usecases'

function parseIncomingEvent(event: unknown): IncomingEvent {
  if (typeof event !== 'object' || event === null || Array.isArray(event)) {
    throw new TypeError('Expected an event object')
  }

  const input = event as Record<string, unknown>
  if (
    !Object.hasOwn(input, 'id') ||
    typeof input.id !== 'string' ||
    !input.id.trim() ||
    !Object.hasOwn(input, 'payload')
  ) {
    throw new TypeError('Expected an event with a non-empty id and payload')
  }

  return { id: input.id, payload: input.payload }
}

export function receiveEventHandler(app: FastifyInstance) {
  const publisher = app.diContainer.resolve('eventPublisher')
  const logger = app.diContainer.resolve('logger')

  return async (event: unknown): Promise<void> => {
    try {
      await receiveEvent(publisher, parseIncomingEvent(event))
    } catch (err) {
      logger.error({ err }, 'Receiver handler failed')
      throw err
    }
  }
}

export default async function receiverResource(app: FastifyInstance): Promise<void> {
  const outerReceiver = app.diContainer.resolve('outerReceiver')
  const handler = receiveEventHandler(app)

  app.addHook('onReady', async () => {
    outerReceiver.subscribe(handler)
  })

  app.addHook('onClose', async () => {
    await outerReceiver.unsubscribe(handler)
  })
}
