import { FastifyBaseLogger, FastifyInstance } from "fastify";
import { Server, Socket } from "socket.io";

import { getLastMessage, getNewMessages } from "../../db/messages";
import { hasConversationAccess } from "../../db/sessions";
import { getConversation } from "../../db/conversations";
import { DB_FETCH_INTERVAL, EVENTS, LiveServiceName } from "./constants";
import { ConversationDbListener } from "./types";

/**
 * TODO reuse common methods to base class
 */
export class LiveService {
    server: FastifyInstance;

    log: FastifyBaseLogger;

    private _io?: Server;

    get io (): Server {
        if (!this._io) {
            throw Error("Socket IO is not defined");
        }
        return this._io;
    }

    set io (value: Server) {
        this._io = value;
    }

    listeners: ConversationDbListener[];

    constructor ({ server }: { server: FastifyInstance }) {
        this.server = server;
        this.log = server.log;
        this.listeners = [];
    }

    connect () {
        const connectedServer = this.server as FastifyInstance & {
            io: Server;
        };
        if (!connectedServer.io) {
            throw Error("[LiveService] Cannot connect Socket IO");
        }
        this._io = connectedServer.io;

        this.io.on("connection", this.initSocket.bind(this));

        this.listenDb();
    }

    async initSocket (socket: Socket) {
        if (!socket.handshake.auth.services?.includes(LiveServiceName)) {
            return;
        }

        this.log.info(`[LiveService] Socket #${socket.id} ${socket.recovered ? "re-" : ""}connected`);

        this.listenConversation(socket);

        socket.on(EVENTS.STOP_LISTENING_CONVERSATION, () => this.stopListener(socket));
        socket.on("disconnect", () => {
            this.log.info(`[LiveService] Socket #${socket.id} disconnected`);
            this.stopListener(socket);
        });
    }

    listenConversation (socket: Socket) {
        socket.on(EVENTS.LISTEN_CONVERSATION, async ({ conversationId, session }: {
            conversationId: string;
            session: string;
        }) => {
            this.log.info(`[LiveService] Init room for conversation ${conversationId} by session ${session}`);

            if (!conversationId || !session) {
                this.closeSocket(socket, "[LiveService] Bad request!");
                return;
            }

            const conversation = await getConversation(conversationId);
            if (!conversation) {
                this.closeSocket(socket, "[LiveService] Conversation Not Found!");
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
        });
    }

    async checkAuth (socket: Socket, session: string, conversationId: string) {
        const isSessionValid = await hasConversationAccess(
            conversationId,
            session,
        );
        if (!isSessionValid) {
            this.closeSocket(socket, "[LiveService] Access Denied!");
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

        listener.lastMessageId = (await getLastMessage(conversationId))?.id;
        if (!listener.sockets.includes(socketId)) {
            listener.sockets.push(socketId);
        }

        return listener;
    }

    listenDb () {
        // TODO use postgres PUBLICATION (listeners/notifications)
        setInterval(async () => {
            for (const listener of this.listeners) {
                if (listener.sockets.length) {
                    await this.syncNewMessages(listener);
                }
            }
        }, DB_FETCH_INTERVAL);
    }

    async syncNewMessages (listener: ConversationDbListener) {
        try {
            const newMessages = await getNewMessages(listener.conversationId, listener.lastMessageId);
            if (newMessages.length > 0) {
                listener.lastMessageId = newMessages[0].id;
                this.sendMessagesToClient(listener.conversationId, newMessages.map(({ id }) =>  id));
            }
        } catch (e) {
            // TODO proper handling, send event to client
            this.log.error(e);
        }
    }

    stopListener (socket: Socket) {
        const socketId = socket.id;
        const conversationId = socket.data.conversationId;
        if (!conversationId) {
            this.log.error(`[LiveService] Cannot stop listening for socket ${socketId}, no conversation`);
            return;
        }

        this.log.info(`[LiveService] Stop listening conversation ${conversationId}`);

        socket.leave(conversationId);

        const listenerIndex = this.listeners.findIndex((listener) => listener.conversationId === conversationId);
        if (listenerIndex < 0) {
            this.log.error(`[LiveService] Listener ${socketId} for conversation ${conversationId} lost`);
            return;
        }

        const listener = this.listeners[listenerIndex];
        const socketIndex = listener.sockets.indexOf(socketId);
        if (socketIndex > -1) {
            listener.sockets.splice(socketIndex);
        }
        if (!listener.sockets.length) {
            this.listeners.splice(listenerIndex);
        }
    }

    sendMessagesToClient (conversationId: string, messagesIds: string[]) {
        this.log.info(`[LiveService] Sending messages to client ${conversationId}`);
        this.io.to(conversationId).emit(EVENTS.NEW_MESSAGES, messagesIds);
    }

    closeSocket (socket: Socket, message?: string) {
        if (message) socket.emit(EVENTS.ERROR, { message });
        socket.disconnect(true);
    }
}
