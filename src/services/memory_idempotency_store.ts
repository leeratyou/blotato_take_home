import type { IdempotencyStore } from '@/domain/ports'

// Covers provider redelivery: a comment older than seven days can no longer get a private reply.
const TTL_MS = 7 * 24 * 60 * 60 * 1000

export class MemoryIdempotencyStore implements IdempotencyStore {
  // In-memory: lost on restart and not shared between instances.
  // Replace with Redis `SET NX PX` or a Postgres unique key before production.
  // Every claim appends a new key with the same TTL, so expired keys form a prefix of the map.
  private readonly expiresAt = new Map<string, number>()

  async claim(key: string): Promise<boolean> {
    const now = Date.now()
    for (const [claimed, expiry] of this.expiresAt) {
      if (expiry > now) break
      this.expiresAt.delete(claimed)
    }

    if (this.expiresAt.has(key)) return false
    this.expiresAt.set(key, now + TTL_MS)
    return true
  }

  async release(key: string): Promise<void> {
    this.expiresAt.delete(key)
  }
}
