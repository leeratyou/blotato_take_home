import type { Delivery, SentDelivery } from '@/domain/deliveries'
import type { SendingConfirmEvent } from '@/domain/events'
import type { DeliveryStore } from '@/domain/ports'

type DeliveryKey = Pick<Delivery, 'source' | 'accountId' | 'externalId'>

function key(delivery: DeliveryKey): string {
  return JSON.stringify([delivery.source, delivery.accountId, delivery.externalId])
}

// Per-process only: records are lost on restart and are not shared between workers.
export class MemoryDeliveryStore implements DeliveryStore {
  private readonly deliveries = new Map<string, Delivery>()
  private readonly answers = new Map<string, string>()

  async findByAnswerId(answerId: string): Promise<(SentDelivery & Delivery) | undefined> {
    const deliveryKey = this.answers.get(answerId)
    const delivery = deliveryKey === undefined ? undefined : this.deliveries.get(deliveryKey)
    if (!delivery || delivery.answerId === undefined) return undefined
    return { ...delivery, answerId: delivery.answerId }
  }

  async recordSent(delivery: SentDelivery): Promise<void> {
    const deliveryKey = key(delivery)
    const previous = this.deliveries.get(deliveryKey)
    this.deliveries.set(deliveryKey, {
      ...delivery,
      status: previous?.status ?? 'sent',
      ...(previous?.confirmedAt ? { confirmedAt: previous.confirmedAt } : {}),
    })
    this.answers.set(delivery.answerId, deliveryKey)
  }

  async confirm(event: SendingConfirmEvent): Promise<void> {
    const deliveryKey = key(event)
    const previous = this.deliveries.get(deliveryKey)
    this.deliveries.set(deliveryKey, {
      source: event.source,
      accountId: event.accountId,
      participantId: event.participantId,
      conversationId: event.conversationId,
      externalId: event.externalId,
      ...previous,
      status: 'confirmed',
      confirmedAt: previous?.confirmedAt ?? event.occurredAt,
    })
  }

  async get(deliveryKey: DeliveryKey): Promise<Delivery | undefined> {
    const delivery = this.deliveries.get(key(deliveryKey))
    return delivery ? { ...delivery } : undefined
  }
}
