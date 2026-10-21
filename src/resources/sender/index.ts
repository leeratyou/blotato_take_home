import type { FastifyInstance } from 'fastify'
import type { BusEvent } from '@/domain/events'
import { confirmSending, createAnswerSender } from '@/resources/sender/sender.usecases'

export function sendAnswerHandler(app: FastifyInstance) {
  const ports = {
    sender: app.diContainer.resolve('messageSender'),
    publisher: app.diContainer.resolve('eventPublisher'),
    deliveries: app.diContainer.resolve('deliveryStore'),
  }
  const dispatchAnswer = createAnswerSender(ports)
  const logger = app.diContainer.resolve('logger')

  return async (event: BusEvent): Promise<void> => {
    try {
      if (event.type === 'answer') await dispatchAnswer(event)
      else if (event.type === 'sending_confirm') await confirmSending(ports, event)
      else throw new TypeError('Expected an answer or sending_confirm event')
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
    eventBus.subscribe('sending_confirm', handler)
  })

  app.addHook('onClose', async () => {
    eventBus.unsubscribe('answer', handler)
    eventBus.unsubscribe('sending_confirm', handler)
  })
}
