export type ConversationDbListener = {
    conversationId: string;
    sockets: string[];
    lastMessageId?: string;
};
