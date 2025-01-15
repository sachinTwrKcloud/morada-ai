const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const EVENT_CLIENT_SEND_MESSAGE = "EVENT_CLIENT_SEND_MESSAGE";
const EVENT_SERVER_SEND_MESSAGE = "EVENT_SERVER_SEND_MESSAGE";
const EVENT_SERVER_INIT_MESSAGE_LIST = "EVENT_SERVER_INIT_MESSAGE_LIST";
const EVENT_ERROR = "EVENT_ERROR";

app.get("/", (req, res) => {
    res.send("WebSocket Test Server Running");
});

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Send chat history on connection
    socket.emit(EVENT_SERVER_INIT_MESSAGE_LIST, [
        { id: "1", content: "Welcome!", from: "Server", createdAt: new Date(), status: "delivered" },
        { id: "2", content: "How can I help you?", from: "Server", createdAt: new Date(), status: "sent" },
    ]);

    // Handle client message
    socket.on(EVENT_CLIENT_SEND_MESSAGE, (message) => {
        console.log("Received message from client:", message);

        // Echo back the message
        const serverMessage = {
            id: Date.now().toString(),
            content: message.content,
            from: "Client",
            createdAt: new Date(),
            status: "sent",
        };

        socket.emit(EVENT_SERVER_SEND_MESSAGE, serverMessage);
    });

    // Handle errors
    socket.on("error", (err) => {
        console.error("Socket error:", err);
        socket.emit(EVENT_ERROR, { message: "An error occurred." });
    });

    // Disconnect event
    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

// Start the server
const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
