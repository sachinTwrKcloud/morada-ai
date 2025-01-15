import axios from "axios";
import { v4 } from "uuid";
import { Server, Socket } from "socket.io";
import { FastifyBaseLogger, FastifyInstance } from "fastify";

import { CHAT_CHANNEL_DOMAIN, ChatServiceName, EVENTS } from "./constants";
import {
    ChatStateDTO,
    ClientMessageDto,
    MessageActors,
    MessageContentChatState,
    MessageContentMediaLink,
    MessageStatus,
    MessageType, MiaChatState,
    MiaMessageDto,
    ServerMessageDto,
    StatusDTO,
} from "../../types";
import { getRoomMessages, MessageDbRow } from "../../db/messages";
import { getInstanceByChatId, getInstanceById, InstanceDbRow } from "../../db/bots";
import { getRoomPerson } from "../../db/people";
import { mapMessageDTO } from "../../utils";

export class ChatService {
    server: FastifyInstance;

    log: FastifyBaseLogger;

    private _io?: Server;

    get io (): Server {
        if (!this._io) {
            throw Error("[ChatService] Socket IO is not defined");
        }
        return this._io;
    }

    set io (value: Server) {
        this._io = value;
    }

    constructor ({ server }: { server: FastifyInstance }) {
        this.server = server;
        this.log = server.log;
    }

    connect () {
        const connectedServer = this.server as FastifyInstance & {
            io: Server;
        };
        if (!connectedServer.io) {
            throw Error("[ChatService] Cannot connect Socket IO");
        }
        this._io = connectedServer.io;

        this.io.on("connection", this.initSocket.bind(this));
    }

    async initSocket (socket: Socket) {
        // ChatService is default service for websocket-api, skip init if other services requested
        const services = socket.handshake.auth.services;
        if (services?.length && !services.includes(ChatServiceName)) {
            return;
        }

        this.log.info(`[Chat service] Socket #${socket.id} ${socket.recovered ? "re-" : ""}connected`);

        socket.on("disconnect", () => {
            this.log.info(`[ChatService] Socket #${socket.id} disconnected`);
        });

        const isInstanceValid = await this.initInstance(socket);
        if (!isInstanceValid) return;

        await this.initRoom(socket);
        await this.initConversation(socket);

        this.listenForClient(socket);
    }

    async initInstance (socket: Socket) {
        socket.data.instance = await getInstanceByChatId(socket.handshake.auth.instance?.chatId || "");

        if (!socket.data.instance) {
            this.closeSocket(socket, "[ChatService] Chat Instance Error!");
            return;
        }
        if (!socket.data.instance.props.chat?.enabled) {
            this.closeSocket(socket, "[ChatService] Instance Chat Access Denied!");
            return false;
        }
        if (socket.handshake.auth.instance?.token !== socket.data.instance.props.chat?.clientToken) {
            this.closeSocket(socket, "[ChatService] Instance Access Denied!");
            return false;
        }
        return true;
    }

    async initRoom (socket: Socket) {
        const roomId = socket.handshake.auth.roomId || v4();
        this.log.info(`Init room ${roomId}`);

        socket.data.roomId = roomId;
        socket.join(roomId);
        socket.emit(EVENTS.EVENT_INIT_ROOM, {
            roomId,
            instance: {
                id: socket.data.instance.id,
                name: socket.data.instance.name,
                avatar: socket.data.instance.avatar,
                color: socket.data.instance.props.chat?.color,
            },
        });

        if (socket.handshake.auth.roomId) {
            socket.data.person = await getRoomPerson(roomId);
            if (socket.data.person) {
                this.sendPersonDataToClient(socket);
            }
        }
    }

    async initConversation (socket: Socket) {
        if (!socket.recovered) {
            const messages = await getRoomMessages(socket.data.roomId, socket.data.instance.id);
            this.log.info(`[ChatService] Sending initial messages: ${messages.length}`);

            socket.emit(EVENTS.EVENT_SERVER_INIT_MESSAGE_LIST, messages.map(mapMessageDTO));
        }
    }

    listenForClient (socket: Socket) {
        let isFirstMessage = true;

        socket.on(EVENTS.EVENT_CLIENT_SEND_MESSAGE, async ({ content }: ClientMessageDto) => {
            const message: ServerMessageDto = {
                id: v4(),
                content,
                from: socket.data.person?.name,
                createdAt: new Date().toISOString(),
                status: MessageStatus.Sent,
                direction: "outgoing",
                type: MessageType.Text,
            };
            this.log.info(`[ChatService] Processing message ${message.id} from room ${socket.data.roomId}`);

            this.sendMessageToClient(socket.data.roomId, message);

            try {
                const messageDbRow: MessageDbRow = {
                    id: message.id,
                    from: `${socket.data.roomId}@${CHAT_CHANNEL_DOMAIN}`,
                    to: socket.data.instance.props.chat.id,
                    content: message.content.toString(),
                    type: message.type,
                    metadata: {
                        "#uniqueId": message.id,
                        ...isFirstMessage && socket.handshake.auth.referral && {
                            "#chat.referral": JSON.stringify(socket.handshake.auth.referral),
                        },
                    },
                    actor: MessageActors.User,
                    createdAt: message.createdAt,
                };
                await axios.post(`${process.env.MIA_GATEWAY_BASE_URL}/receiveMessage`, messageDbRow);
                isFirstMessage = false;
            } catch (e) {
                this.log.error(`[ChatService] Send message to Mia error ${e}`);
                console.error(e);

                this.sendMessageStatusToClient(socket.data.roomId, {
                    messageId: message.id,
                    status: MessageStatus.Failed,
                });
            }
        });
    }

    sendPersonDataToClient (socket: Socket) {
        this.log.info(`[ChatService] Sending person data to room ${socket.data.roomId}`);

        const { name, email, phoneNumber } = socket.data.person || {};
        this.io.to(socket.data.roomId).emit(EVENTS.EVENT_SERVER_SEND_USER_DATA, {
            name,
            email,
            phoneNumber,
        });
    }

    async getInstanceForSystemMessage (instanceId: number, systemToken: string) {
        const instance = await getInstanceById(instanceId);
        if (!instance) {
            throw Error("[ChatService] Instance Error!");
        }
        if (!instance.props.chat?.enabled) {
            throw Error("[ChatService] Instance Chat Access Denied!");
        }
        if (systemToken !== instance.props.chat?.systemToken) {
            throw Error("[ChatService] Instance Access Denied!");
        }
        return instance;
    }

    sendSystemMessage (instance: InstanceDbRow, { id, to, type, content }: MiaMessageDto) {
        const roomId = to.split("@")[0];
        switch (type) {
            case MessageType.Text: {
                this.sendMessageToClient(roomId, {
                    id,
                    content: content.toString(),
                    from: instance.name,
                    status: MessageStatus.Sent,
                    createdAt: new Date().toISOString(),
                    direction: "incoming",
                    type: MessageType.Text,
                });
                break;
            }
            case MessageType.MediaLink: {
                this.sendMessageToClient(roomId, {
                    id,
                    content: content as MessageContentMediaLink,
                    from: instance.name,
                    status: MessageStatus.Sent,
                    createdAt: new Date().toISOString(),
                    direction: "incoming",
                    type: MessageType.MediaLink,
                });
                break;
            }
            case MiaChatState.ChatState: {
                this.sendChatStateToClient(roomId, {
                    from: instance.name,
                    state: (content as MessageContentChatState).state,
                });
                break;
            }
            default: {
                throw Error("[ChatService] Unsupported message type!");
            }
        }
    }

    sendMessageToClient (roomId: string, message: ServerMessageDto) {
        this.log.info(`[ChatService] Sending message ${message.id} to client ${roomId}`);
        this.io.to(roomId).emit(EVENTS.EVENT_SERVER_SEND_MESSAGE, message);
    }

    sendChatStateToClient (roomId: string, state: ChatStateDTO) {
        this.io.to(roomId).emit(EVENTS.EVENT_SERVER_SEND_CHAT_STATE, state);
    }

    sendMessageStatusToClient (roomId: string, status: StatusDTO) {
        this.io.to(roomId).emit(EVENTS.EVENT_SERVER_SEND_MESSAGE_STATUS, status);
    }

    closeSocket (socket: Socket, message?: string) {
        if (message) socket.emit(EVENTS.EVENT_ERROR, { message });
        socket.disconnect(true);
    }
}
