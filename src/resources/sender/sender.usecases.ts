import type { SentDelivery } from '@/domain/deliveries'
import type { AnswerEvent, SendingConfirmEvent } from '@/domain/events'
import type { DeliveryStore, EventPublisher, MessageSender } from '@/domain/ports'

export type SenderPorts = {
  sender: MessageSender
  publisher: EventPublisher
  deliveries: DeliveryStore
}

// Share the whole operation so duplicates cannot slip between dispatch and receipt storage.
export function createAnswerSender(ports: SenderPorts) {
  const pending = new Map<string, Promise<void>>()
  return async (event: AnswerEvent): Promise<void> => {
    const existing = pending.get(event.id)
    if (existing) return existing

    const operation = sendAnswer(ports, event)
    pending.set(event.id, operation)
    try {
      await operation
    } finally {
      pending.delete(event.id)
    }
  }
}

export async function sendAnswer(ports: SenderPorts, event: AnswerEvent): Promise<void> {
  let delivery: SentDelivery | undefined = await ports.deliveries.findByAnswerId(event.id)
  if (!delivery) {
    const receipt = await ports.sender.send(event)
    delivery = {
      answerId: event.id,
      source: event.source,
      accountId: event.accountId,
      participantId: event.participantId,
      conversationId: event.conversationId,
      externalId: receipt.externalId,
    }
    // Keep an accepted receipt before publishing, so a bus retry does not resend it.
    await ports.deliveries.recordSent(delivery)
  }

  await ports.publisher.send({
    id: `send:${delivery.answerId}`,
    type: 'send',
    source: delivery.source,
    accountId: delivery.accountId,
    participantId: delivery.participantId,
    conversationId: delivery.conversationId,
    externalId: delivery.externalId,
    payload: { answerId: delivery.answerId },
  })
}

export async function confirmSending(ports: Pick<SenderPorts, 'deliveries'>, event: SendingConfirmEvent): Promise<void> {
  await ports.deliveries.confirm(event)
}
