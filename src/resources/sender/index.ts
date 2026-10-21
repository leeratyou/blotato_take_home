import type { FastifyInstance } from 'fastify'
import type { BusEvent } from '@/domain/events'
import { sendAnswer } from '@/resources/sender/sender.usecases'

export function sendAnswerHandler(app: FastifyInstance) {
  const ports = {
    sender: app.diContainer.resolve('messageSender'),
    publisher: app.diContainer.resolve('eventPublisher'),
  }
  const logger = app.diContainer.resolve('logger')

  return async (event: BusEvent): Promise<void> => {
    try {
      if (event.type !== 'answer') throw new TypeError('Expected an answer event')
      await sendAnswer(ports, event)
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
    eventBus.unsubscribe('answer', handler)
  })
}
