// Existing SNS integration boundary; authentication and provider HTTP remain external.
export class OuterSender {
  async send(source: string, accountId: string, payload: unknown): Promise<unknown> {
    throw new Error('OuterSender.send is not implemented')
  }
}
