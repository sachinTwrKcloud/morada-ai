# M.I.A Websocket API

## Environments
- Production env: https://mia-chat-api.morada.ai
- Staging env: https://mia-chat-api.staging.morada.ai

## Requirements
Use Socket IO Client: https://socket.io/docs/v4/client-api/
Include script
```
<script src="/socket.io/socket.io.js"></script>
<!-- or by cdn: -->
<script src="https://cdn.socket.io/4.7.5/socket.io.esm.min.js"></script>
```

## How-Tos

### Initialize Chat instance to connect to API server:
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
Chat should be **enabled** in Instance chat config 

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

## Chat Events:
- `"EVENT_SERVER_SEND_MESSAGE"` - message added to chat, including ones that client sent
- `"EVENT_SERVER_INIT_MESSAGE_LIST"` - send all messages from previous conversation, one time after chat connected
- `"EVENT_SERVER_SEND_USER_DATA"` - send user details when person identified or details changed
- `"EVENT_SERVER_SEND_MESSAGE_STATUS"` - message status changed
- `"EVENT_SERVER_SEND_CHAT_STATE"` - send chat status - e.g.,composing for Mia message typing
- `"EVENT_INIT_ROOM"` - chat `roomId` identifier defined or restored due person identified
- `"EVENT_ERROR"` - chat found an error


## Payload types:
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
```