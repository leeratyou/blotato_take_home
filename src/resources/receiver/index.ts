import type { FastifyInstance } from 'fastify'
import { receiveEvent } from '@/resources/receiver/receiver.usecases'

export function receiveEventHandler(app: FastifyInstance) {
  const eventBus = app.diContainer.resolve('eventBus')
  const logger = app.diContainer.resolve('logger')

  return async (event: unknown): Promise<void> => {
    try {
      await receiveEvent(eventBus, logger, event)
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
