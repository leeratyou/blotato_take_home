import type { FastifyInstance } from 'fastify'
import type { BusEvent } from '@/domain/events'
import { generateAnswer } from '@/resources/answering_engine/answering_engine.usecases'

export function generateAnswerHandler(app: FastifyInstance) {
  const publisher = app.diContainer.resolve('eventPublisher')
  const logger = app.diContainer.resolve('logger')

  return async (event: BusEvent): Promise<void> => {
    try {
      if (event.type !== 'new') throw new TypeError('Expected a new event')
      await generateAnswer(publisher, event)
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
