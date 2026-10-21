import type { SendingConfirmEvent } from '@/domain/events'

export type SendReceipt = { externalId: string }

export type SentDelivery = Pick<
  SendingConfirmEvent,
  'source' | 'accountId' | 'participantId' | 'conversationId' | 'externalId'
> & { answerId: string }

// A provider echo confirms sending; it does not prove recipient delivery or reading.
export type Delivery = Omit<SentDelivery, 'answerId'> & {
  answerId?: string
  status: 'sent' | 'confirmed'
  confirmedAt?: string
}
