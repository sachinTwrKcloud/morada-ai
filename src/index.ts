import Fastify from "fastify";
import FastifySocketIo from "fastify-socket.io";
import { ServerOptions } from "socket.io";
import { receiveMessageSchema } from "./schema";
import { MiaMessageDto, MiaRequestParams } from "./types";
import { getPublicPageResponse } from "./utils";
import { ChatServiceName } from "./services/constants";
import { ServiceHandler } from "./services/service-handler";
import { ChatService } from "./services/chat/chat-service";

const server = Fastify({
    logger: !!process.env.SERVER_DEBUG && process.env.SERVER_DEBUG !== "false",
});
server.register(FastifySocketIo, {
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1e3,
    },
    cors: {},
} as ServerOptions);

server.get("/", { logLevel: "warn" }, async function handler (request, reply) {
    await getPublicPageResponse(reply, "index");
});
server.get("/chat", { logLevel: "warn" }, async function handler (request, reply) {
    await getPublicPageResponse(reply, "chat");
});
server.get("/live", { logLevel: "warn" }, async function handler (request, reply) {
    await getPublicPageResponse(reply, "live");
});

server.get("/health-check", { logLevel: "warn" }, async function handler () {});
server.get("/favicon.ico", { logLevel: "warn" }, async function handler () {});
server.get("/mia-chat-api", { logLevel: "warn" }, async function handler () {}); // TODO check why lb call that

const serviceHandler = new ServiceHandler({ server });

server.ready(async (err) => {
    if (err) throw err;

    serviceHandler.init();
});

server.listen({
    port: +(process.env.PORT || 3000),
    host: process.env.HOST || "127.0.0.1",
}, function (err) {
    if (err) {
        server.log.error(err);
        process.exit(1);
    }
    server.log.info("Server initialized");
});

server.post("/receive-message/:instanceId", { schema: receiveMessageSchema }, async function handler (request) {
    const token = request.headers.token as string;
    const { instanceId } = request.params as MiaRequestParams;

    const chatService = serviceHandler.getService<ChatService>(ChatServiceName);
    const instance = await chatService.getInstanceForSystemMessage(instanceId, token);

    const message = request.body as MiaMessageDto;
    chatService.sendSystemMessage(instance, message);
});
