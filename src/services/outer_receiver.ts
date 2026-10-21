export type OuterEventHandler = (event: unknown) => Promise<void>

export class OuterReceiver {
  // The external receiver adapter will deliver events to these handlers.
  private readonly handlers = new Set<OuterEventHandler>()

  subscribe(handler: OuterEventHandler): () => void {
    this.handlers.add(handler)
    return () => this.unsubscribe(handler)
  }

  unsubscribe(handler: OuterEventHandler): void {
    this.handlers.delete(handler)
  }
}
