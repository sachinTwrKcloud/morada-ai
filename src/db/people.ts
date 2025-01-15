import sql from "./db";

export type PersonDbRow = {
    id: string;
    name: string;
    email: string;
    phoneNumber: string;
};

export async function getRoomPerson (roomId: string) {
    return (await sql<PersonDbRow[]>`
        SELECT p.*
        FROM people p
            JOIN conversations c ON c.person_id = p.id
        WHERE c.props->'chat'->>'roomId' = ${roomId}
    `)[0];
}
