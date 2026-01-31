import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostEntity } from '../posts/post.entity';
import { UserEntity } from '../auth/user.entity';
import { SwipeEntity } from '../swipes/swipe.entity';
import { CommentEntity } from '../comments/comment.entity';
import { CommentReactionEntity } from '../comments/comment-reaction.entity';
import { ConversationEntity } from '../messages/conversation.entity';
import { ConversationParticipantEntity } from '../messages/conversation-participant.entity';
import { MessageEntity } from '../messages/message.entity';
import { FollowEntity } from '../social/follow.entity';
import { BlockEntity } from '../social/block.entity';
import { ProfileVisitEntity } from '../social/profile-visit.entity';
import { ProfileMuteEntity } from '../social/profile-mute.entity';
import { RepostEntity } from '../social/repost.entity';
import { SavedPostEntity } from '../social/saved-post.entity';
import { NotificationEntity } from '../notifications/notification.entity';
import { TwoFaOtpEntity } from '../auth/twofa-otp.entity';
import { AuthChallengeEntity } from '../auth/auth-challenge.entity';
import { RecommendationEntity } from '../recommendations/recommendation.entity';
import { AdminEntity } from '../admin/admin.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: String(config.get('DATABASE_HOST') ?? 'localhost'),
        port: Number(config.get('DATABASE_PORT') ?? 5432),
        username: String(config.get('DATABASE_USER') ?? 'postgres'),
        password: String(config.get('DATABASE_PASSWORD') ?? 'postgres'),
        database: String(config.get('DATABASE_NAME') ?? 'nope'),
        entities: [
          UserEntity,
          AdminEntity,
          TwoFaOtpEntity,
          AuthChallengeEntity,
          PostEntity,
          SwipeEntity,
          CommentEntity,
          CommentReactionEntity,
          ConversationEntity,
          ConversationParticipantEntity,
          MessageEntity,
          FollowEntity,
          BlockEntity,
          ProfileVisitEntity,
          ProfileMuteEntity,
          RepostEntity,
          SavedPostEntity,
          NotificationEntity,
          RecommendationEntity,
        ],
        synchronize: String(config.get('NODE_ENV') ?? 'development') !== 'production',
      }),
    }),
  ],
})
export class DatabaseModule {}
