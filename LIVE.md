# Live service

Live updates for platform events: new messages, etc.

Pass `live` code name to socket IO `auth.services` to use it:
```
const socket = io({
    auth: {
        services: ["live"]
    }
});
``` 

### New messages listening

Emit `LISTEN_CONVERSATION` event so service start listen for conversation's new messages created on db.
New messages ids will be sent to `NEW_MESSAGES` subscribers.

Listening conversation linked to current socket connection. 
When socket disconnected or `STOP_LISTENING_CONVERSATION` emitted, 
service will stop listen this conversation changes.    

`conversationId` and platform `session` user token required for `LISTEN_CONVERSATION` event: 
```
socket.emit(LISTEN_CONVERSATION, { 
  conversationId: "conversationId", 
  session: "platformSessonUserToken" 
});
socket.on(NEW_MESSAGES, (messageIds) => console.log(messageIds));
```

### Testing
See example of using Live Service on [public/live.html](public/live.html). 

Available on http://127.0.0.1:3000/live
