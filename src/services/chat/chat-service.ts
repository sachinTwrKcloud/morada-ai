import axios from "axios";
import { v4 } from "uuid";
import { Socket } from "socket.io";

import { ChatServiceName, CHAT_CHANNEL_DOMAIN,  EVENTS } from "../constants";
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
import { ServiceBase } from "../service-base";

export class ChatService extends ServiceBase {
    name = ChatServiceName;

    async initSocket (socket: Socket) {
        const isInstanceValid = await this.initInstance(socket);
        if (!isInstanceValid) return;

        await this.initRoom(socket);
        await this.initConversation(socket);

        this.listenForClient(socket);
    }

    async initInstance (socket: Socket) {
        socket.data.instance = await getInstanceByChatId(socket.handshake.auth.instance?.chatId || "");

        if (!socket.data.instance) {
            this.closeSocket(socket, "[Chat Service] Chat Instance Error!");
            return;
        }
        if (!socket.data.instance.props.chat?.enabled) {
            this.closeSocket(socket, "[Chat Service] Instance Chat Access Denied!");
            return false;
        }
        if (socket.handshake.auth.instance?.token !== socket.data.instance.props.chat?.clientToken) {
            this.closeSocket(socket, "[Chat Service] Instance Access Denied!");
            return false;
        }
        return true;
    }

    async initRoom (socket: Socket) {
        const roomId = socket.handshake.auth.roomId || v4();
        this.log.info(`Init room ${roomId}`, socket.id);

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
            this.log.info(`Sending initial messages: ${messages.length}`, socket.id);

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
            this.log.info(`Processing message ${message.id} from room ${socket.data.roomId}`, socket.id);

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
                this.log.error(`Send message to Mia error ${e}`, socket.id);
                console.error(e);

                this.sendMessageStatusToClient(socket.data.roomId, {
                    messageId: message.id,
                    status: MessageStatus.Failed,
                });
            }
        });
    }

    sendPersonDataToClient (socket: Socket) {
        this.log.info(`Sending person data to room ${socket.data.roomId}`, socket.id);

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
            throw Error("[Chat Service] Instance Error!");
        }
        if (!instance.props.chat?.enabled) {
            throw Error("[Chat Service] Instance Chat Access Denied!");
        }
        if (systemToken !== instance.props.chat?.systemToken) {
            throw Error("[Chat Service] Instance Access Denied!");
        }
        return instance;
    }

    sendSystemMessage (instance: InstanceDbRow, { id, to, type, content }: MiaMessageDto) {
        this.log.info("Received system message");

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
                throw Error("[Chat Service] Unsupported message type!");
            }
        }
    }

    sendMessageToClient (roomId: string, message: ServerMessageDto) {
        this.io.to(roomId).emit(EVENTS.EVENT_SERVER_SEND_MESSAGE, message);
    }

    sendChatStateToClient (roomId: string, state: ChatStateDTO) {
        this.io.to(roomId).emit(EVENTS.EVENT_SERVER_SEND_CHAT_STATE, state);
    }

    sendMessageStatusToClient (roomId: string, status: StatusDTO) {
        this.io.to(roomId).emit(EVENTS.EVENT_SERVER_SEND_MESSAGE_STATUS, status);
    }
}
