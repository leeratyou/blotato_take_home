import type { BusEvent } from '@/domain/events'
import type { EventPublisher } from '@/domain/ports'

export type BusEventHandler = (event: BusEvent) => Promise<void>

export class EventBus implements EventPublisher {
  // Append-only, in-memory: lost on restart, not shared between instances, unbounded.
  // Replace with a durable store (Postgres outbox) before production.
  private readonly events: BusEvent[] = []
  private readonly handlers = new Map<BusEvent['type'], Set<BusEventHandler>>()

  subscribe(type: BusEvent['type'], handler: BusEventHandler): () => void {
    const handlers = this.handlers.get(type) ?? new Set<BusEventHandler>()
    this.handlers.set(type, handlers)
    handlers.add(handler)

    return () => this.unsubscribe(type, handler)
  }

  unsubscribe(type: BusEvent['type'], handler: BusEventHandler): void {
    const handlers = this.handlers.get(type)
    handlers?.delete(handler)
    if (handlers?.size === 0) this.handlers.delete(type)
  }

  async send(event: BusEvent): Promise<void> {
    throw new Error('EventBus.send is not implemented')
  }
}
