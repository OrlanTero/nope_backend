import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../storage/storage.module';
import { UserEntity } from '../auth/user.entity';
import { PostEntity } from '../posts/post.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommentEntity } from './comment.entity';
import { CommentReactionEntity } from './comment-reaction.entity';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [TypeOrmModule.forFeature([CommentEntity, CommentReactionEntity, UserEntity, PostEntity]), StorageModule, NotificationsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
