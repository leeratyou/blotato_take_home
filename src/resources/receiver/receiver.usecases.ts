import type { InboundEvent } from '@/domain/events'
import type { EventPublisher, IdempotencyStore } from '@/domain/ports'

export async function receiveEvent(
  publisher: EventPublisher,
  idempotency: IdempotencyStore,
  event: InboundEvent,
): Promise<void> {
  if (!(await idempotency.claim(event.id))) return // Provider redelivery

  // TODO: Apply business matching and filtering before publishing.
  // A crash between claim and send loses the event; a transactional outbox closes this gap.
  try {
    await publisher.send({ ...event, type: 'new' })
  } catch (err) {
    // Without release, the provider's retry would be dropped as a duplicate.
    await idempotency.release(event.id)
    throw err
  }
}
