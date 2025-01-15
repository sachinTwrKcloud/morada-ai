import sql from "./db";

export async function hasConversationAccess (conversationId: string, sessionToken: string) {
    const users = await sql`
        SELECT DISTINCT s.id AS count
        FROM
            sessions s
            JOIN users u ON u.id = s.user_id
            LEFT JOIN partner_users pu ON pu.user_id = u.id
            LEFT JOIN bots b ON b.partner_id = pu.partner_id
            LEFT JOIN conversations c ON c.bot_id = b.id 
        WHERE
            s.session_token = ${sessionToken} 
            AND u.active 
            AND (
                u.role = 'admin'
                OR (
                    pu.active 
                    AND pu.deleted_at IS NULL
                    AND c.id::text = ${conversationId}
                )
            )
        LIMIT 1
    `;
    return !!users.length;
}
