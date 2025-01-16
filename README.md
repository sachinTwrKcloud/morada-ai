# MIA Websocket API
Socket service for MIA synchronization processes.

Includes services:
 - Chat Service (code name: `chat`) - communication with Mia Chat Channel Instance.  [Docs](CHAT.md)
 - Live Service (code name: `live`) - live updates for platform events: new messages, etc. [Docs](LIVE.md)

To use services pass service code name into socket IO `auth` object:
```
const socket = io({
    auth: {
        services: ['chat, 'live']
    }
});
```
Chat service used by default if no `services` provided.

Using concrete service assumes that client can subscribe only to this service events.


### Socket Client Docs
https://socket.io/docs/v4/client-api/

### Requirements
- yarn@^4
- Node 20

### Code quality
- eslint

### Server deployment
Run `yarn && yarn dev` or `yarn && yarn build && yarn start` to start Websocket API server
