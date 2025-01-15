import sql from "./db";

export async function getConversation (conversationId: string) {
    return (await sql`
        SELECT * FROM conversations
        WHERE id::text = ${conversationId}
        LIMIT 1
    `)[0];
}
