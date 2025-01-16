import { Server, Socket } from "socket.io";
import { FastifyBaseLogger, FastifyInstance } from "fastify";
import { ServiceBase } from "./service-base";
import { ChatService } from "./chat/chat-service";
import { LiveService } from "./live/live-service";
import { ChatServiceName } from "./constants";

export class ServiceHandler {
    server: FastifyInstance;

    log: FastifyBaseLogger;

    private _io?: Server;

    get io (): Server {
        if (!this._io) {
            throw Error("[Chat Service] Socket IO is not defined");
        }
        return this._io;
    }

    set io (value: Server) {
        this._io = value;
    }

    services: ServiceBase[];

    constructor ({ server }: { server: FastifyInstance }) {
        this.server = server;
        this.log = server.log;

        this.services = [
            new ChatService({ server }),
            new LiveService({ server }),
        ];
    }

    hasService (name: string) {
        return this.services.some((service) => service.name === name);
    }

    getService<T extends ServiceBase>(name: string): T {
        const service = this.services.find((service) => service.name === name);
        if (!service) throw new Error(`[Service Handler] Service ${name} not found`);
        return service as unknown as T;
    }

    init () {
        const connectedServer = this.server as FastifyInstance & {
            io: Server;
        };
        if (!connectedServer.io) {
            throw Error("[Service Handler] Cannot connect Socket IO");
        }
        this.io = connectedServer.io;
        for (const service of this.services) {
            service.io = this.io;
        }

        this.io.on("connection", this.initSocket.bind(this));
    }

    initSocket (socket: Socket) {
        const services = socket.handshake.auth.services;
        socket.data.services = (Array.isArray(services) ? services : [ChatServiceName])
            .filter((name) => this.hasService(name));

        this.log.info(
            `[${socket.data.services.join(", ")}] #${socket.id}: ${socket.recovered ? "re-" : ""}connected`,
        );

        for (const serviceName of socket.data.services) {
            const service = this.getService(serviceName);
            service.addSocket(socket);
            service.initSocket(socket);
        }

        socket.on("disconnect", () => {
            this.log.info(`[${socket.data.services.join(", ")}] #${socket.id}: Disconnected`);

            for (const serviceName of socket.data.services) {
                const service = this.getService(serviceName);
                service.removeSocket(socket);
            }
        });
    }
}
