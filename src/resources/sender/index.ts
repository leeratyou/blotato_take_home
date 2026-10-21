import type { FastifyInstance } from 'fastify'
import type { BusEvent } from '@/services/event_bus'
import { sendAnswer } from '@/resources/sender/sender.usecases'

export function sendAnswerHandler(app: FastifyInstance) {
  const outerSender = app.diContainer.resolve('outerSender')
  const eventBus = app.diContainer.resolve('eventBus')
  const logger = app.diContainer.resolve('logger')

  return async (event: BusEvent): Promise<void> => {
    try {
      await sendAnswer(outerSender, eventBus, logger, event)
    } catch (err) {
      logger.error({ err, eventId: event.id }, 'Sender handler failed')
      throw err
    }
  }
}

export default async function sender(app: FastifyInstance) {
  const eventBus = app.diContainer.resolve('eventBus')
  const handler = sendAnswerHandler(app)

  app.addHook('onReady', async () => {
    eventBus.subscribe('answer', handler)
  })

  app.addHook('onClose', async () => {
    await eventBus.unsubscribe('answer', handler)
  })
}
