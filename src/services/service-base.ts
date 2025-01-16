import { Server, Socket } from "socket.io";
import { FastifyInstance } from "fastify";

import { EVENTS } from "./constants";

export abstract class ServiceBase {
    server: FastifyInstance;

    log: {
        info: (message: string, socketId?: string) => void;
        error: (message: string, socketId?: string) => void;
    };

    abstract name: string;

    private _io?: Server;

    get io (): Server {
        if (!this._io) {
            throw Error(`[${this.name}] Socket IO is not defined`);
        }
        return this._io;
    }

    set io (value: Server) {
        this._io = value;
    }

    sockets: string[] = [];

    constructor ({ server }: { server: FastifyInstance }) {
        this.server = server;
        this.log = {
            info: (message: string, socketId?: string) =>
                server.log.info(`[${this.name}] ${socketId ? `#${socketId}: ` : ""}${message}`),
            error: (message: string, socketId?: string) =>
                server.log.error(`[${this.name}] ${socketId ? `#${socketId}: ` : ""}${message}`),
        };
    }

    abstract initSocket (socket: Socket): void;

    addSocket (socket: Socket) {
        this.sockets.push(socket.id);
        this.log.info(`Sockets count: ${this.sockets.length}`, socket.id);
    }

    removeSocket (socket: Socket) {
        this.sockets.splice(this.sockets.indexOf(socket.id), 1);
        this.log.info(`Sockets count: ${this.sockets.length}`, socket.id);
    }

    closeSocket (socket: Socket, message?: string) {
        this.log.info(`Manually close socket #${socket.id}`, socket.id);
        if (message) socket.emit(EVENTS.EVENT_ERROR, { message });
        socket.disconnect(true);
    }
}
