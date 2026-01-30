import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import type { Repository } from 'typeorm';
import { StorageService } from '../storage/storage.service';
import { RecommendationEntity } from './recommendation.entity';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly storageService: StorageService,
    @InjectRepository(RecommendationEntity)
    private readonly recosRepo: Repository<RecommendationEntity>,
  ) {}

  async create(params: {
    userId: string;
    body?: string;
    gifUrl?: string;
    file?: Express.Multer.File;
    baseUrl: string;
  }) {
    const body = (params.body ?? '').trim();
    const gifUrl = (params.gifUrl ?? '').trim();

    if (!body && !gifUrl && !params.file) {
      throw new BadRequestException('recommendation must include body, gifUrl, or media');
    }

    const mediaUrl = params.file
      ? await this.storageService.saveUploadedFile({
          file: params.file,
          baseUrl: params.baseUrl,
          prefix: 'recommendations',
        })
      : null;

    const created = await this.recosRepo.save(
      this.recosRepo.create({
        id: randomUUID(),
        userId: params.userId,
        body,
        gifUrl: gifUrl || null,
        mediaUrl,
        isDeleted: false,
      }),
    );

    const hydrated = await this.recosRepo.findOne({ where: { id: created.id }, relations: { user: true } });
    return this.toDto(hydrated ?? created);
  }

  async list(params: { beforeId?: string; limit?: number }) {
    const limit = Math.min(200, Math.max(1, params.limit ?? 50));

    let beforeCreatedAt: Date | null = null;
    if (params.beforeId) {
      const before = await this.recosRepo.findOne({ where: { id: params.beforeId } });
      if (before) beforeCreatedAt = before.createdAt;
    }

    const qb = this.recosRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'user')
      .where('r.isDeleted = false')
      .orderBy('r.createdAt', 'DESC')
      .take(limit);

    if (beforeCreatedAt) {
      qb.andWhere('r.createdAt < :beforeCreatedAt', { beforeCreatedAt });
    }

    const rows = await qb.getMany();
    const items = rows.map((r) => this.toDto(r));
    return { items };
  }

  async getById(params: { id: string }) {
    const row = await this.recosRepo.findOne({ where: { id: params.id }, relations: { user: true } });
    if (!row || row.isDeleted) throw new NotFoundException('Recommendation not found');
    return { recommendation: this.toDto(row) };
  }

  private toDto(r: RecommendationEntity) {
    const displayName = r.user?.displayName ?? r.user?.username ?? r.user?.email;
    return {
      id: r.id,
      userId: r.userId,
      userDisplayName: displayName,
      userAvatarUrl: r.user?.avatarUrl ?? null,
      body: r.isDeleted ? '' : r.body,
      gifUrl: r.isDeleted ? null : r.gifUrl ?? null,
      mediaUrl: r.isDeleted ? null : r.mediaUrl ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
