import type { FastifyInstance } from 'fastify'
import answeringEngine from '@/resources/answering_engine'
import receiver from '@/resources/receiver'
import sender from '@/resources/sender'

export default async function resources(app: FastifyInstance) {
  await app.register(answeringEngine)
  await app.register(sender)
  await app.register(receiver)
}
