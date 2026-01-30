import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto';
import { CreateGroupConversationDto } from './dto/create-group-conversation.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { MuteConversationDto } from './dto/mute-conversation.dto';
import { PinConversationDto } from './dto/pin-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesService } from './messages.service';

type AuthedRequest = Request & { user: { userId: string; email: string } };

@Controller('conversations')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @UseGuards(JwtAuthGuard)
  @Post('direct')
  async createDirect(@Req() req: AuthedRequest, @Body() dto: CreateDirectConversationDto) {
    const convo = await this.messagesService.createDirectConversation({
      userId: req.user.userId,
      otherUserId: dto.otherUserId,
    });
    return { conversation: convo };
  }

  @UseGuards(JwtAuthGuard)
  @Post('group')
  async createGroup(@Req() req: AuthedRequest, @Body() dto: CreateGroupConversationDto) {
    const convo = await this.messagesService.createGroupConversation({
      userId: req.user.userId,
      title: dto.title,
      participantUserIds: dto.participantUserIds,
    });
    return { conversation: convo };
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async inbox(@Req() req: AuthedRequest) {
    return this.messagesService.listConversations({ userId: req.user.userId });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/messages')
  async listMessages(@Req() req: AuthedRequest, @Param('id') id: string, @Query() q: ListMessagesDto) {
    return this.messagesService.listMessages({
      userId: req.user.userId,
      conversationId: id,
      beforeId: q.beforeId,
      limit: q.limit,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/messages')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'media', maxCount: 1 }], {
      storage: memoryStorage(),
      limits: { fileSize: 1024 * 1024 * 50, files: 1 },
    }),
  )
  async send(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @UploadedFiles() files: { media?: Express.Multer.File[] },
  ) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const message = await this.messagesService.sendMessage({
      userId: req.user.userId,
      conversationId: id,
      type: dto.type,
      text: dto.text,
      gifUrl: dto.gifUrl,
      replyToMessageId: dto.replyToMessageId,
      file: files?.media?.[0],
      baseUrl,
    });

    return { message };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/read')
  async read(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: MarkReadDto) {
    return this.messagesService.markRead({
      userId: req.user.userId,
      conversationId: id,
      lastReadMessageId: dto.lastReadMessageId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/pin')
  async pin(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: PinConversationDto) {
    return this.messagesService.setPinned({
      userId: req.user.userId,
      conversationId: id,
      pinned: dto.pinned,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/mute')
  async mute(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: MuteConversationDto) {
    return this.messagesService.mute({
      userId: req.user.userId,
      conversationId: id,
      muteForSeconds: dto.muteForSeconds,
    });
  }
}
