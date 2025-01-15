# Chat client

Communication with Mia Chat Channel Instance

### Testing
See example of using Chat on `public/index.html`.

Include script
```
<script src="/socket.io/socket.io.js"></script>
<!-- or by cdn: -->
<script src="https://cdn.socket.io/4.7.5/socket.io.esm.min.js"></script>
```
Initialize Chat instance to connect to API server:
```
const socket = io({
    auth: {
        instance: {
            chatId: "UniqueChatId",     // required, instance chat channel id (`bots.props->'chat'->>'id'`)
            token: "TokenFromInstance", // required, instance token (`bots.props->'chat'->>'clientToken'`)
        },
        roomId: "uniqueRoomId",         // optional, person identifier
    }
});
```
Chat should be **enabled** in Instance chat config - `bots.props->chat->>enabled = true`

### Send message to Mia:
```
socket.emit(EVENT_CLIENT_SEND_MESSAGE, { content: "Hello Mia!" });
```

### Listen messages from Mia:
```
socket.on(EVENT_SERVER_SEND_MESSAGE, ({ id, content, from, createdAt, status }: ServerMessageDto) => {
    item = document.createElement('li');
    item.setAttribute("id", `message_${id}`);
    item.innerHTML = `${content}, by ${from}`;
    document.getElementById('messages').appendChild(item);
});
```

Chat Events:
- `"EVENT_SERVER_SEND_MESSAGE"` - message added to chat, including ones that client sent
- `"EVENT_SERVER_INIT_MESSAGE_LIST"` - send all messages from previous conversation, one time after chat connected
- `"EVENT_SERVER_SEND_USER_DATA"` - send user details when person identified or details changed
- `"EVENT_SERVER_SEND_MESSAGE_STATUS"` - message status changed
- `"EVENT_SERVER_SEND_CHAT_STATE"` - send chat status - e.g.,composing for Mia message typing
- `"EVENT_INIT_ROOM"` - chat `roomId` identifier defined or restored due person identified
- `"EVENT_ERROR"` - chat found an error

### Payload types:
```
type ClientMessageDto = {
    content: string;
};
type ServerMessageDto = {
    id: string;
    content: string;
    from: string;
    status: "sent" | "delivered" | "read" | "failed";
    createdAt: string;
    direction: "outgoing" | "incoming";
    type: "text/plain" | "application/vnd.lime.media-link+json";
}
type StatusDTO = {
    messageId: string;
    status: "sent" | "delivered" | "read" | "failed";
}
type PersonDTO = {
    name: string | null;
    email: string | null;
    phoneNumber: string | null;
}
export type ChatStateDTO = {
    from: string;
    state: "composing" | string;
};
```

# Mia messages

To send message from Mia to client use POST request: `/receive-message/:instanceId`.

Request header `token` is required from `bots.props->'chat'->>'systemToken'`.

Recipient conversation room defined by `"to"` body parameter and has format `${roomId}@${CHAT_CHANNEL_DOMAIN}` (or just `${roomId}`).

Example:
```
> POST /receive-message/34/1234 HTTP/1.1
> Content-Type: application/json
> token: MiaStagingSystemChatToken
> Accept: */*

| {
| 	"id": "1212",
| 	"type": "text/plain",
| 	"content": "Hi!",
|   "to": "1234@chat.channel.morada.ai" 
| }

< HTTP/1.1 200 OK
```

Request body json schema:
```
{
    type: "object",
    required: ["id", "content", "to"],
    properties: {
        id: { type: "string" },
        type: { type: "string" },
        content: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
    },
}
```
