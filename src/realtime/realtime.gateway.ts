import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Socket } from 'socket.io';
import { Server } from 'socket.io';
import type { Repository } from 'typeorm';
import { ConversationParticipantEntity } from '../messages/conversation-participant.entity';

type AuthedSocket = Socket & { userId?: string };

@WebSocketGateway({
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 20000,
})
export class RealtimeGateway {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(ConversationParticipantEntity)
    private readonly participantsRepo: Repository<ConversationParticipantEntity>,
  ) {}

  @WebSocketServer()
  server!: Server;

  handleConnection(client: AuthedSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) throw new UnauthorizedException('Missing token');

      const payload = this.jwtService.verify(token);
      const userId = String((payload as any)?.sub ?? '');
      if (!userId) throw new UnauthorizedException('Invalid token');

      client.userId = userId;
      client.join(this.userRoom(userId));
      this.logger.log(`socket connected userId=${userId} socketId=${client.id}`);
    } catch (e) {
      this.logger.warn(`socket auth failed socketId=${client.id} err=${(e as any)?.message ?? e}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket) {
    if (client.userId) {
      this.logger.log(`socket disconnected userId=${client.userId} socketId=${client.id}`);
    }
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  private extractToken(client: AuthedSocket): string | null {
    const authToken = (client.handshake as any)?.auth?.token;
    if (typeof authToken === 'string' && authToken.trim().length > 0) return authToken;

    const header = (client.handshake as any)?.headers?.authorization;
    if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
      return header.slice('bearer '.length).trim();
    }

    const queryToken = (client.handshake as any)?.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim().length > 0) return queryToken;

    return null;
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(this.userRoom(userId)).emit(event, payload);
  }

  emitTrendingUpdate(payload: unknown) {
    this.server.emit('trending:update', payload);
  }

  @SubscribeMessage('messages:typing')
  async typing(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId?: string; on?: boolean },
  ) {
    const userId = client.userId;
    if (!userId) throw new UnauthorizedException();
    const conversationId = String(body?.conversationId ?? '');
    if (!conversationId) return { ok: false };

    const isPart = await this.participantsRepo.exist({ where: { conversationId, userId } });
    if (!isPart) throw new UnauthorizedException();

    const parts = await this.participantsRepo.find({ where: { conversationId } });
    for (const p of parts) {
      if (p.userId === userId) continue;
      this.emitToUser(p.userId, 'messages:typing', {
        conversationId,
        fromUserId: userId,
        on: body?.on === true,
      });
    }

    return { ok: true };
  }

  @SubscribeMessage('messages:delivered')
  async delivered(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId?: string; messageId?: string },
  ) {
    const userId = client.userId;
    if (!userId) throw new UnauthorizedException();
    const conversationId = String(body?.conversationId ?? '');
    const messageId = String(body?.messageId ?? '');
    if (!conversationId || !messageId) return { ok: false };

    const isPart = await this.participantsRepo.exist({ where: { conversationId, userId } });
    if (!isPart) throw new UnauthorizedException();

    const parts = await this.participantsRepo.find({ where: { conversationId } });
    for (const p of parts) {
      if (p.userId === userId) continue;
      this.emitToUser(p.userId, 'messages:delivered', {
        conversationId,
        messageId,
        byUserId: userId,
      });
    }

    return { ok: true };
  }

  @SubscribeMessage('ping')
  ping(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: unknown) {
    return { event: 'pong', data: { ...((body as any) ?? {}), userId: client.userId ?? null } };
  }
}
