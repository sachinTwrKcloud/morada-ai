import sql from "./db";
import { CHAT_CHANNEL_DOMAIN } from "../services/constants";
import { MessageActors, MessageStatus, MessageType } from "../types";

export type MessageMetadata = {
    "#uniqueId": string;
    "#chat.referral"?: string;
    message_log_error?: {
        status: MessageStatus;
        timestamp: number;
        errors?: { message?: string }[];
    };
};

export type MessageDbRow = {
    id: string;
    from: string;
    to: string;
    type: MessageType;
    content: string;
    actor: MessageActors;
    metadata: MessageMetadata;
    createdAt: string;
    deliveredAt?: string;
    readAt?: string;
};

export async function getRoomMessages (roomId: string, botId: string) {
    return sql<MessageDbRow[]>`
        SELECT m.*
        FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            JOIN people p ON p.id = c.person_id
        WHERE
            c.bot_id = ${botId}
            AND p.props->>'messagingIdentifier' = ${`${roomId}@${CHAT_CHANNEL_DOMAIN}`}
            AND c.finished_at IS NULL
            AND (
                m.actor = 'user' 
                OR (
                    m.actor = 'assistant'
                    AND (
                        m.type = 'text/plain'
                        OR (
                            m.metadata->'openai'->'choices'->0->'message'->'function_call' IS NULL
                            AND m.metadata->'openai'->'choices'->0->'message'->'tool_calls' IS NULL
                        )
                    )
                )
                OR (m.actor = 'function' AND type = 'application/vnd.lime.media-link+json')
            ) 
        ORDER BY created_at
    `;
}
