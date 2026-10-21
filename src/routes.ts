import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"

async function healthcheck(_: FastifyRequest, rep: FastifyReply) {
	return rep.send({ app: 'blotato_take_home', ok: true, date: new Date().toISOString(), commit: process.env.COMMIT, id: process.env.APP_ID })
}

export default async function routes(app: FastifyInstance) {
	app.get('/healthcheck', healthcheck)
}
