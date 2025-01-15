export const receiveMessageSchema = {
    headers: {
        type: "object",
        required: ["token"],
        properties: {
            token: { type: "string" },
        },
    },
    params: {
        type: "object",
        properties: {
            instanceId: { type: "number" },
        },
    },
    body: {
        type: "object",
        required: ["id", "content", "to"],
        properties: {
            id: { type: "string" },
            type: { type: "string" },
            content: {},
            from: { type: "string" },
            to: { type: "string" },
        },
    },
    response: {
        200: {
            type: "object",
            properties: {},
        },
    },
};