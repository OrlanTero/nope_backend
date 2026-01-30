import 'reflect-metadata';

import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { UserEntity } from './auth/user.entity';
import { PostEntity } from './posts/post.entity';
import { SwipeEntity } from './swipes/swipe.entity';
import { CommentEntity } from './comments/comment.entity';
import { AdminEntity } from './admin/admin.entity';

function env(name: string, fallback: string) {
  return String(process.env[name] ?? fallback);
}

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: env('DATABASE_HOST', 'localhost'),
    port: Number(env('DATABASE_PORT', '5432')),
    username: env('DATABASE_USER', 'postgres'),
    password: env('DATABASE_PASSWORD', 'postgres'),
    database: env('DATABASE_NAME', 'nope'),
    entities: [UserEntity, AdminEntity, PostEntity, SwipeEntity, CommentEntity],
    synchronize: false,
  });

  await ds.initialize();

  const usersRepo = ds.getRepository(UserEntity);
  const adminsRepo = ds.getRepository(AdminEntity);
  const postsRepo = ds.getRepository(PostEntity);
  const swipesRepo = ds.getRepository(SwipeEntity);
  const commentsRepo = ds.getRepository(CommentEntity);

  const adminEmail = env('ADMIN_EMAIL', 'admin@nope.local').toLowerCase();
  const adminPassword = env('ADMIN_PASSWORD', '@Admin123456');
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const existingAdmin = await adminsRepo.findOne({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await adminsRepo.save(
      adminsRepo.create({
        id: randomUUID(),
        email: adminEmail,
        passwordHash: adminPasswordHash,
        isSuper: true,
      }),
    );
  }

  const passwordHash = await bcrypt.hash('@User123456', 10);

  const avatarUrls = [
    'https://i.pravatar.cc/256?img=1',
    'https://i.pravatar.cc/256?img=2',
    'https://i.pravatar.cc/256?img=3',
    'https://i.pravatar.cc/256?img=4',
    'https://i.pravatar.cc/256?img=5',
    'https://i.pravatar.cc/256?img=6',
    'https://i.pravatar.cc/256?img=7',
    'https://i.pravatar.cc/256?img=8',
    'https://i.pravatar.cc/256?img=9',
    'https://i.pravatar.cc/256?img=10',
  ];

  const seedNames: Array<{ first: string; last: string }> = [
    { first: 'Ava', last: 'Martinez' },
    { first: 'Noah', last: 'Kim' },
    { first: 'Mia', last: 'Patel' },
    { first: 'Liam', last: 'Chen' },
    { first: 'Sophia', last: 'Nguyen' },
    { first: 'Ethan', last: 'Garcia' },
    { first: 'Olivia', last: 'Johnson' },
    { first: 'Lucas', last: 'Wright' },
    { first: 'Isabella', last: 'Brown' },
    { first: 'James', last: 'Anderson' },
  ];

  const usernameFromName = (first: string, last: string, n: number) => {
    const base = `${first}${last}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${base}${n}`;
  };

  const seedUsers: UserEntity[] = [];
  for (let i = 0; i < 10; i++) {
    const email = `user${i + 1}@nope.local`;
    const name = seedNames[i % seedNames.length]!;
    const displayName = `${name.first} ${name.last}`;
    const username = usernameFromName(name.first, name.last, i + 1);

    let existing = await usersRepo.findOne({ where: { email } });
    if (!existing) {
      existing = await usersRepo.save(
        usersRepo.create({
          id: randomUUID(),
          email,
          username,
          passwordHash,
          provider: 'password',
          displayName,
          avatarUrl: avatarUrls[i] ?? null,
          emailVerified: true,
          profileVerified: false,
          profileSet: true,
        }),
      );
    }

    seedUsers.push(existing);
  }

  const sampleImageSets: string[][] = [
    [
      'https://picsum.photos/seed/nope1/900/900',
      'https://picsum.photos/seed/nope2/900/900',
      'https://picsum.photos/seed/nope3/900/900',
    ],
    [
      'https://picsum.photos/seed/outfit1/900/900',
      'https://picsum.photos/seed/outfit2/900/900',
      'https://picsum.photos/seed/outfit3/900/900',
      'https://picsum.photos/seed/outfit4/900/900',
    ],
    ['https://picsum.photos/seed/meme1/1080/1080'],
    ['https://picsum.photos/seed/grid1/1080/1080', 'https://picsum.photos/seed/grid2/1080/1080'],
  ];

  const sampleVideos = [
    {
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      coverUrl: 'https://picsum.photos/seed/video1/1080/1080',
      trackTitle: 'Trending – Bassline 404',
      description: '15s fit check – bassline 404',
      hashtags: ['#fitcheck', '#bassline'],
    },
    {
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      coverUrl: 'https://picsum.photos/seed/video2/1080/1080',
      trackTitle: 'NOPE Original – Neon Pulse',
      description: '30s vibe – neon pulse',
      hashtags: ['#vibes', '#neon'],
    },
  ];

  const createdPosts: PostEntity[] = [];

  for (let i = 0; i < 18; i++) {
    const creator = seedUsers[i % seedUsers.length]!;
    const images = sampleImageSets[i % sampleImageSets.length]!;

    const p = await postsRepo.save(
      postsRepo.create({
        id: randomUUID(),
        creatorId: creator.id,
        kind: 'photo',
        description: [
          'Outfit of the day',
          'Meme drop',
          'Photo grid',
          'Clean fit. No caption.',
        ][i % 4]!,
        hashtags: ['#nope', '#dope', '#style'].slice(0, (i % 3) + 1),
        privacy: 'everyone',
        imageUrls: images,
        coverUrl: images[0] ?? null,
        trackTitle: null,
        videoUrl: null,
      }),
    );

    createdPosts.push(p);
  }

  for (let i = 0; i < sampleVideos.length; i++) {
    const creator = seedUsers[(i + 3) % seedUsers.length]!;
    const v = sampleVideos[i]!;

    const p = await postsRepo.save(
      postsRepo.create({
        id: randomUUID(),
        creatorId: creator.id,
        kind: 'video',
        description: v.description,
        hashtags: v.hashtags,
        privacy: 'everyone',
        imageUrls: null,
        coverUrl: v.coverUrl,
        trackTitle: v.trackTitle,
        videoUrl: v.videoUrl,
      }),
    );

    createdPosts.push(p);
  }

  // Seed some comments for commentCount badge
  for (let i = 0; i < createdPosts.length; i++) {
    const post = createdPosts[i]!;
    const count = (i % 5) + 1;
    for (let j = 0; j < count; j++) {
      const u = seedUsers[(i + j) % seedUsers.length]!;
      await commentsRepo.save(
        commentsRepo.create({
          id: randomUUID(),
          targetType: 'post',
          targetId: post.id,
          userId: u.id,
          parentId: null,
          body: ['DOPE', 'NOPE', '🔥', 'fit goes hard', 'this is wild'][j % 5]!,
          mediaUrl: null,
          gifUrl: null,
          mentions: [],
          isDeleted: false,
        }),
      );
    }
  }

  // Seed some swipes
  for (let i = 0; i < createdPosts.length; i++) {
    const post = createdPosts[i]!;
    for (let j = 0; j < seedUsers.length; j++) {
      if ((i + j) % 3 !== 0) continue;
      const u = seedUsers[j]!;
      const verdict: 'DOPE' | 'NOPE' = (i + j) % 2 === 0 ? 'DOPE' : 'NOPE';
      await swipesRepo.upsert(
        {
          userId: u.id,
          postId: post.id,
          verdict,
        },
        { conflictPaths: ['userId', 'postId'] },
      );
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded users=${seedUsers.length}, posts=${createdPosts.length}`);

  await ds.destroy();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
