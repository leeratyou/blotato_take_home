import type { FastifyInstance } from 'fastify'
import { parseInbound } from '@/resources/receiver/adapters'
import { receiveEvent } from '@/resources/receiver/receiver.usecases'

export function receiveEventHandler(app: FastifyInstance) {
  const publisher = app.diContainer.resolve('eventPublisher')
  const idempotency = app.diContainer.resolve('idempotencyStore')
  const logger = app.diContainer.resolve('logger')

  return async (source: string, event: unknown): Promise<void> => {
    try {
      for (const inbound of parseInbound(source, event)) {
        await receiveEvent(publisher, idempotency, inbound)
      }
    } catch (err) {
      logger.error({ err, source }, 'Receiver handler failed')
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
