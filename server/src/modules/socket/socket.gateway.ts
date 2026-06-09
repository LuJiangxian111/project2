import { WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

interface ClientInfo {
  userId: number;
  socketId: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : ['http://localhost:5173'],
    credentials: true,
  },
})
export class SocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('SocketGateway');
  private clients: Map<string, ClientInfo> = new Map();

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId ? Number(client.handshake.query.userId) : null;
    if (userId) {
      this.clients.set(client.id, { userId, socketId: client.id });
      this.logger.log(`Client connected: ${client.id}, UserId: ${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.clients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  broadcast(event: string, data: any) {
    this.server.emit(event, data);
  }

  broadcastToUser(userId: number, event: string, data: any) {
    this.clients.forEach((clientInfo, socketId) => {
      if (clientInfo.userId === userId) {
        this.server.to(socketId).emit(event, data);
      }
    });
  }

  broadcastToAllUsers(event: string, data: any) {
    this.server.emit(event, data);
  }
}