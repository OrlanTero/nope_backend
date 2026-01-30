import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { type Repository } from 'typeorm';
import { AdminEntity } from './admin.entity';
import { AdminJwtPayload } from './admin.types';
import { AdminLoginDto } from './dto/admin-login.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(AdminEntity)
    private readonly adminsRepo: Repository<AdminEntity>,
  ) {}

  async login(dto: AdminLoginDto) {
    const admin = await this.adminsRepo.findOne({ where: { email: dto.email.toLowerCase() } });
    if (!admin) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.issueTokens(admin);
    return { admin: this.toSafeAdmin(admin), ...tokens };
  }

  async refresh(refreshToken: string) {
    const refreshSecret = String(
      this.configService.get('JWT_ADMIN_REFRESH_SECRET') ?? 'dev_admin_refresh',
    );

    let payload: AdminJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.kind !== 'admin') throw new UnauthorizedException('Invalid refresh token');

    const admin = await this.adminsRepo.findOne({ where: { id: payload.sub } });
    if (!admin) throw new UnauthorizedException('Invalid refresh token');

    const tokens = await this.issueTokens(admin);
    return { admin: this.toSafeAdmin(admin), ...tokens };
  }

  async me(adminId: string) {
    const admin = await this.adminsRepo.findOne({ where: { id: adminId } });
    if (!admin) throw new UnauthorizedException();
    return this.toSafeAdmin(admin);
  }

  async issueTokens(admin: AdminEntity) {
    const payload: AdminJwtPayload = { sub: admin.id, email: admin.email, kind: 'admin' };

    const expiresIn = Number(this.configService.get('JWT_ADMIN_EXPIRATION') ?? 3600);
    const refreshExpiresIn = Number(
      this.configService.get('JWT_ADMIN_REFRESH_EXPIRATION') ?? 60 * 60 * 24 * 30,
    );

    const secret = String(this.configService.get('JWT_ADMIN_SECRET') ?? 'dev_admin');
    const refreshSecret = String(
      this.configService.get('JWT_ADMIN_REFRESH_SECRET') ?? 'dev_admin_refresh',
    );

    const accessToken = await this.jwtService.signAsync(payload, { secret, expiresIn });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  private toSafeAdmin(admin: AdminEntity) {
    return {
      id: admin.id,
      email: admin.email,
      isSuper: admin.isSuper === true,
    };
  }
}
