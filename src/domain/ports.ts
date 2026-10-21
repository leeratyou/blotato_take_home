import type { Delivery, SendReceipt, SentDelivery } from '@/domain/deliveries'
import type { AnswerEvent, BusEvent, SendingConfirmEvent } from '@/domain/events'

export interface EventPublisher {
  send(event: BusEvent): Promise<void>
}

export interface MessageSender {
  send(answer: AnswerEvent): Promise<SendReceipt>
}

export interface DeliveryStore {
  findByAnswerId(answerId: string): Promise<(SentDelivery & Delivery) | undefined>
  recordSent(delivery: SentDelivery): Promise<void>
  confirm(event: SendingConfirmEvent): Promise<void>
}

export interface IdempotencyStore {
  // Atomically records the key; false when it is already claimed.
  claim(key: string): Promise<boolean>
  release(key: string): Promise<void>
}
