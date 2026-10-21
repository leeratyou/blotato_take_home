import type { FastifyInstance } from 'fastify'
import type { BusEvent } from '@/domain/events'
import { confirmSending, createAnswerSender } from '@/resources/sender/sender.usecases'

export function sendAnswerHandler(app: FastifyInstance) {
  const dispatchAnswer = createAnswerSender({
    sender: app.diContainer.resolve('messageSender'),
    publisher: app.diContainer.resolve('eventPublisher'),
    deliveries: app.diContainer.resolve('deliveryStore'),
  })
  const logger = app.diContainer.resolve('logger')

  return async (event: BusEvent): Promise<void> => {
    try {
      if (event.type !== 'answer') throw new TypeError('Expected an answer event')
      await dispatchAnswer(event)
    } catch (err) {
      logger.error({ err, eventId: event.id }, 'Failed to send answer')
      throw err
    }
  }
}

export function confirmSendingHandler(app: FastifyInstance) {
  const ports = { deliveries: app.diContainer.resolve('deliveryStore') }
  const logger = app.diContainer.resolve('logger')

  return async (event: BusEvent): Promise<void> => {
    try {
      if (event.type !== 'sending_confirm') throw new TypeError('Expected a sending_confirm event')
      await confirmSending(ports, event)
    } catch (err) {
      logger.error({ err, eventId: event.id }, 'Failed to confirm sending')
      throw err
    }
  }
}

export default async function sender(app: FastifyInstance) {
  const eventBus = app.diContainer.resolve('eventBus')
  const sendAnswer = sendAnswerHandler(app)
  const confirm = confirmSendingHandler(app)

  app.addHook('onReady', async () => {
    eventBus.subscribe('answer', sendAnswer)
    eventBus.subscribe('sending_confirm', confirm)
  })

  app.addHook('onClose', async () => {
    eventBus.unsubscribe('answer', sendAnswer)
    eventBus.unsubscribe('sending_confirm', confirm)
  })
}
