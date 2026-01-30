import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { UserEntity } from '../auth/user.entity';
import { PostEntity } from '../posts/post.entity';
import { CommentEntity } from '../comments/comment.entity';
import { CommentReactionEntity } from '../comments/comment-reaction.entity';
import { SwipeEntity } from '../swipes/swipe.entity';
import { RepostEntity } from '../social/repost.entity';
import { SavedPostEntity } from '../social/saved-post.entity';
import { RecommendationEntity } from '../recommendations/recommendation.entity';
import { AdminEntity } from './admin.entity';
import { AdminController } from './admin.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtStrategy } from './admin-jwt.strategy';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminEntity,
      UserEntity,
      PostEntity,
      CommentEntity,
      CommentReactionEntity,
      SwipeEntity,
      RepostEntity,
      SavedPostEntity,
      RecommendationEntity,
    ]),
    PassportModule,
    LeaderboardModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: String(config.get('JWT_ADMIN_SECRET') ?? 'dev_admin'),
        signOptions: {
          expiresIn: Number(config.get('JWT_ADMIN_EXPIRATION') ?? 3600),
        },
      }),
    }),
  ],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminAuthService, AdminJwtStrategy, AdminService],
  exports: [AdminAuthService],
})
export class AdminModule {}
