import type { InboundEvent } from '@/domain/events'
import type { EventPublisher, IdempotencyStore } from '@/domain/ports'

export type ReceiverPorts = {
  publisher: EventPublisher
  idempotency: IdempotencyStore
}

export async function receiveEvent(ports: ReceiverPorts, event: InboundEvent): Promise<void> {
  if (!(await ports.idempotency.claim(event.id))) return // Provider redelivery

  // TODO: Apply business matching and filtering before publishing.
  // A crash between claim and send loses the event; a transactional outbox closes this gap.
  try {
    await ports.publisher.send(event)
  } catch (err) {
    // Without release, the provider's retry would be dropped as a duplicate.
    await ports.idempotency.release(event.id)
    throw err
  }
}

// Each event is processed independently, so one failure does not block the rest of the batch.
// A provider retry re-processes only the failures; published events are skipped as duplicates.
export async function receiveEvents(ports: ReceiverPorts, events: InboundEvent[]): Promise<void> {
  const failures: unknown[] = []
  for (const event of events) {
    try {
      await receiveEvent(ports, event)
    } catch (err) {
      failures.push(err)
    }
  }

  if (failures.length) {
    throw new AggregateError(failures, `${failures.length}/${events.length} inbound events failed`)
  }
}
