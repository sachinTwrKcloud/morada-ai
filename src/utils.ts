import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { FastifyReply } from "fastify";
import { MessageActors, MessageStatus, MessageType, ServerMessageDto } from "./types";
import { MessageDbRow } from "./db/messages";

export const delay = (time: number) => {
    return new Promise((resolve) => setTimeout(resolve, time));
};

export const getPublicPageResponse = async (reply: FastifyReply, page: string) => {
    const data = await readFile(join(process.cwd(), `public/${page}.html`));
    reply.header("content-type", "text/html; charset=utf-8");
    reply.send(data);
};

export const getStatusFromDbMessage = ({
    deliveredAt, readAt, metadata,
}: Pick<MessageDbRow, "deliveredAt" | "readAt" | "metadata">): MessageStatus => {
    if (readAt) return MessageStatus.Read;
    if (deliveredAt) return MessageStatus.Delivered;

    if (metadata.message_log_error) return MessageStatus.Failed;

    return MessageStatus.Sent;
};

const mapMessageContent = (content: string, type: MessageType) => {
    if (type === MessageType.Text) return content;
    try {
        return JSON.parse(content);
    } catch (e) {
        return content;
    }
};

export const mapMessageDTO = ({ id, content, actor, createdAt, type, ...other }: MessageDbRow): ServerMessageDto => {
    return {
        id,
        content: mapMessageContent(content, type),
        from: actor, // TODO person or bot name
        createdAt,
        status: getStatusFromDbMessage(other),
        direction: actor === MessageActors.User ? "outgoing" : "incoming",
        type,
    };
};
