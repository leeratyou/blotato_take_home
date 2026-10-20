import { fastifyAwilixPlugin } from '@fastify/awilix'
import Fastify from 'fastify'
import { buildContainer } from '@/di_container'

const app = Fastify({ logger: true })

await app.register(fastifyAwilixPlugin, { container: buildContainer(app.log) })

app.get('/health', async () => ({ status: 'ok' }))

try {
  await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
