import { FastifyInstance } from "fastify";
import { Socket } from "socket.io";

import { hasConversationAccess } from "../../db/sessions";
import { getConversation } from "../../db/conversations";
import { LiveServiceName, EVENTS } from "../constants";
import { ConversationDbListener } from "./types";
import { ServiceBase } from "../service-base";
import sql from "../../db/db";

export class LiveService extends ServiceBase {
    name = LiveServiceName;

    listeners: ConversationDbListener[];

    constructor ({ server }: { server: FastifyInstance }) {
        super({ server });
        this.listeners = [];

        this.listenDb();
    }

    async initSocket (socket: Socket) {
        this.listenConversation(socket);

        socket.on(EVENTS.STOP_LISTENING_CONVERSATION, () => this.stopListener(socket));
        socket.on("disconnect", () => {
            this.stopListener(socket);
        });
    }

    listenConversation (socket: Socket) {
        socket.on(EVENTS.LISTEN_CONVERSATION, async ({ conversationId, session }: {
            conversationId: string;
            session: string;
        }) => {
            this.log.info(`Init room for conversation ${conversationId} by session ${session}`, socket.id);

            if (!conversationId || !session) {
                this.closeSocket(socket, "[Live Service] Bad request!");
                return;
            }

            const conversation = await getConversation(conversationId);
            if (!conversation) {
                this.closeSocket(socket, "[Live Service] Conversation Not Found!");
                return;
            }

            const isValid = await this.checkAuth(socket, session, conversationId);
            if (!isValid) return;

            if (socket.data.conversationId) {
                this.stopListener(socket);
            }

            socket.join(conversationId);
            socket.data.conversationId = conversationId;

            await this.addListener(socket);

            const listeningSocketsLength = this.listeners.reduce((memo, { sockets }) => memo + sockets.length, 0);
            this.log.info(
                `Listening ${this.listeners.length} conversations by ${listeningSocketsLength} sockets`,
                socket.id,
            );
        });
    }

    async checkAuth (socket: Socket, session: string, conversationId: string) {
        const isSessionValid = await hasConversationAccess(
            conversationId,
            session,
        );
        if (!isSessionValid) {
            this.closeSocket(socket, "[Live Service] Access Denied!");
            return false;
        }
        return true;
    }

    async addListener (socket: Socket) {
        const socketId = socket.id;
        const conversationId = socket.data.conversationId;

        const existingListener = this.listeners.find((listener) => listener.conversationId === conversationId);
        const listener: ConversationDbListener = existingListener || {
            conversationId,
            sockets: [],
        };
        if (!existingListener) {
            this.listeners.push(listener);
        }

        if (!listener.sockets.includes(socketId)) {
            listener.sockets.push(socketId);
        }

        return listener;
    }

    async listenDb () {
        await sql.listen("messages_insert_event", (payload) => {
            const message = JSON.parse(payload);

            for (const listener of this.listeners) {
                if (listener.sockets.length && listener.conversationId === message.conversation_id) {
                    this.sendMessagesToClient(listener.conversationId, [message.id]);
                }
            }
        });
    }

    stopListener (socket: Socket) {
        const socketId = socket.id;
        const conversationId = socket.data.conversationId;
        if (!conversationId) {
            this.log.info("No conversation while stop listener", socket.id);
            return;
        }

        this.log.info(`Stop listening conversation ${conversationId}`, socket.id);

        socket.leave(conversationId);

        const listenerIndex = this.listeners.findIndex((listener) => listener.conversationId === conversationId);
        if (listenerIndex < 0) {
            this.log.error(`Listener ${socketId} for conversation ${conversationId} lost`, socket.id);
            return;
        }

        const listener = this.listeners[listenerIndex];
        const socketIndex = listener.sockets.indexOf(socketId);
        if (socketIndex > -1) {
            listener.sockets.splice(socketIndex, 1);
        }
        if (!listener.sockets.length) {
            this.listeners.splice(listenerIndex, 1);
        }
    }

    sendMessagesToClient (conversationId: string, messagesIds: string[]) {
        this.log.info(`Sending conversation message Ids ${conversationId}`);
        this.io.to(conversationId).emit(EVENTS.NEW_MESSAGES, messagesIds);
    }
}
