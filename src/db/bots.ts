import sql from "./db";

export type InstanceDbRow = {
    id: number;
    name: string;
    props: {
        chat?: {
            id?: string;
            enabled?: boolean;
            clientToken?: string;
            systemToken?: string;
        };
    };
};

export async function getInstanceByChatId (id: string) {
    if (!id) return undefined;
    return (await sql<InstanceDbRow[]>`
        SELECT b.*
        FROM bots b
        WHERE b.props->'chat'->>'id' = ${id} 
        LIMIT 1
    `)[0];
}


export async function getInstanceById (id: number) {
    return (await sql<InstanceDbRow[]>`
        SELECT b.*
        FROM bots b
        WHERE b.id = ${id} 
        LIMIT 1
    `)[0];
}
