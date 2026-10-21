import type { FastifyInstance } from 'fastify'
import { parseInbound } from '@/resources/receiver/adapters'
import { receiveEvents } from '@/resources/receiver/receiver.usecases'

export function receiveEventHandler(app: FastifyInstance) {
  const ports = {
    publisher: app.diContainer.resolve('eventPublisher'),
    idempotency: app.diContainer.resolve('idempotencyStore'),
  }
  const logger = app.diContainer.resolve('logger')

  return async (source: string, raw: unknown): Promise<void> => {
    try {
      const { events, errors } = parseInbound(source, raw)
      // Malformed items fail the same way on every retry, so they are logged and dropped.
      for (const err of errors) logger.error({ err, source }, 'Dropped malformed inbound item')
      await receiveEvents(ports, events)
    } catch (err) {
      logger.error({ err, source }, 'Receiver handler failed')
      throw err
    }
  }
}

export default async function receiver(app: FastifyInstance): Promise<void> {
  const outerReceiver = app.diContainer.resolve('outerReceiver')
  const handler = receiveEventHandler(app)

  app.addHook('onReady', async () => {
    outerReceiver.subscribe(handler)
  })

  app.addHook('onClose', async () => {
    outerReceiver.unsubscribe(handler)
  })
}
