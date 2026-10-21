import type { FastifyInstance } from 'fastify'
import type { BusEvent } from '@/domain/events'
import { generateAnswer } from '@/resources/answering_engine/answering_engine.usecases'

export function generateAnswerHandler(app: FastifyInstance) {
  const ports = { publisher: app.diContainer.resolve('eventPublisher') }
  const logger = app.diContainer.resolve('logger')

  return async (event: BusEvent): Promise<void> => {
    try {
      if (event.type !== 'comment_received' && event.type !== 'dm_message') {
        throw new TypeError('Expected a comment_received or dm_message event')
      }
      await generateAnswer(ports, event)
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
    eventBus.subscribe('comment_received', handler)
    eventBus.subscribe('dm_message', handler)
  })

  app.addHook('onClose', async () => {
    eventBus.unsubscribe('comment_received', handler)
    eventBus.unsubscribe('dm_message', handler)
  })
}
