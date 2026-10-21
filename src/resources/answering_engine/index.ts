import type { FastifyInstance } from 'fastify'
import type { BusEvent } from '@/services/event_bus'
import { generateAnswer } from '@/resources/answering_engine/answering_engine.usecases'

export function generateAnswerHandler(app: FastifyInstance) {
  const eventBus = app.diContainer.resolve('eventBus')
  const logger = app.diContainer.resolve('logger')

  return async (event: BusEvent): Promise<void> => {
    try {
      await generateAnswer(eventBus, logger, event)
    } catch (err) {
      logger.error({ err, eventId: event.id }, 'Failed to generate answer')
      throw err
    }
  }
}

export default async function answeringEngine(app: FastifyInstance) {
  const eventBus = app.diContainer.resolve('eventBus')
  const handler = generateAnswerHandler(app)

  app.addHook('onReady', async () => {
    eventBus.subscribe('new', handler)
  })

  app.addHook('onClose', async () => {
    await eventBus.unsubscribe('new', handler)
  })
}
