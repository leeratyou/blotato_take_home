// `source` names the integration that delivered the event and selects its parser.
export type OuterEventHandler = (source: string, event: unknown) => Promise<void>

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
