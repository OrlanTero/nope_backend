import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { IsNull, type Repository } from 'typeorm';
import { AuthChallengeEntity, type AuthChallengePurpose } from './auth-challenge.entity';
import { JwtPayload } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SetupProfileDto } from './dto/setup-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { EmailService } from '../email/email.service';
import { StorageService } from '../storage/storage.service';
import { TwoFaOtpEntity } from './twofa-otp.entity';
import { UserEntity } from './user.entity';

@Injectable()
export class AuthService {
  private readonly passwordResetTokens = new Map<
    string,
    { userId: string; expiresAt: number }
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(TwoFaOtpEntity)
    private readonly twoFaOtpsRepo: Repository<TwoFaOtpEntity>,
    @InjectRepository(AuthChallengeEntity)
    private readonly authChallengesRepo: Repository<AuthChallengeEntity>,
  ) {}

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    if (user.provider && user.provider !== 'password') {
      throw new UnauthorizedException('Use Google sign-in for this account');
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid current password');

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.provider = 'password';
    const saved = await this.usersRepo.save(user);
    const tokens = await this.issueTokens(saved);
    return { user: this.toSafeUser(saved), ...tokens };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    avatarFile: Express.Multer.File | undefined,
    baseUrl: string,
  ) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    if (dto.username) {
      const normalized = dto.username.toLowerCase();
      const taken = await this.usersRepo.findOne({ where: { username: normalized } });
      if (taken && taken.id !== userId) throw new ConflictException('Username already taken');
    }

    const avatarUrl = avatarFile
      ? await this.storageService.saveUploadedFile({ file: avatarFile, baseUrl, prefix: 'avatars' })
      : undefined;

    const updated = await this.usersRepo.save({
      ...user,
      username: dto.username ? dto.username.toLowerCase() : user.username,
      displayName: dto.displayName ?? user.displayName,
      firstName: dto.firstName ?? user.firstName,
      lastName: dto.lastName ?? user.lastName,
      gender: dto.gender ?? user.gender,
      birthdate: dto.birthdate ?? user.birthdate,
      bio: dto.bio ?? user.bio,
      avatarUrl: avatarUrl ?? user.avatarUrl,
    });

    return { user: this.toSafeUser(updated) };
  }

  private randomOtpCode() {
    const n = Math.floor(Math.random() * 1000000);
    return String(n).padStart(6, '0');
  }

  private async createChallenge(user: UserEntity, purpose: AuthChallengePurpose) {
    const code = this.randomOtpCode();
    const codeHash = await bcrypt.hash(code, 10);
    const ttlMs = 10 * 60 * 1000;

    await this.authChallengesRepo
      .createQueryBuilder()
      .update(AuthChallengeEntity)
      .set({ consumedAt: () => 'NOW()' })
      .where('"userId" = :userId AND purpose = :purpose AND "consumedAt" IS NULL', {
        userId: user.id,
        purpose,
      })
      .execute();

    const created = await this.authChallengesRepo.save(
      this.authChallengesRepo.create({
        id: randomUUID(),
        userId: user.id,
        purpose,
        codeHash,
        expiresAt: new Date(Date.now() + ttlMs),
        consumedAt: null,
      }),
    );

    await this.emailService.sendAuthChallenge({
      to: user.email,
      code,
      purpose,
    });

    return {
      challenge: {
        id: created.id,
        purpose,
        email: user.email,
      },
      user: this.toSafeUser(user),
    };
  }

  async resendChallenge(challengeId: string) {
    const challenge = await this.authChallengesRepo.findOne({ where: { id: challengeId } });
    if (!challenge) throw new BadRequestException('Challenge not found');
    if (challenge.consumedAt) throw new BadRequestException('Challenge already used');

    const user = await this.usersRepo.findOne({ where: { id: challenge.userId } });
    if (!user) throw new BadRequestException('Challenge user not found');

    const code = this.randomOtpCode();
    const codeHash = await bcrypt.hash(code, 10);
    const ttlMs = 10 * 60 * 1000;

    await this.authChallengesRepo.save({
      ...challenge,
      codeHash,
      expiresAt: new Date(Date.now() + ttlMs),
      consumedAt: null,
    });

    await this.emailService.sendAuthChallenge({
      to: user.email,
      code,
      purpose: challenge.purpose,
    });

    return { ok: true };
  }

  async verifyChallenge(challengeId: string, code: string) {
    const challenge = await this.authChallengesRepo.findOne({ where: { id: challengeId } });
    if (!challenge) throw new BadRequestException('Challenge not found');
    if (challenge.consumedAt) throw new BadRequestException('Challenge already used');
    if (challenge.expiresAt.getTime() < Date.now()) throw new BadRequestException('OTP expired');

    const ok = await bcrypt.compare(code, challenge.codeHash);
    if (!ok) throw new BadRequestException('Invalid code');

    await this.authChallengesRepo.save({ ...challenge, consumedAt: new Date() });

    const user = await this.usersRepo.findOne({ where: { id: challenge.userId } });
    if (!user) throw new BadRequestException('Challenge user not found');

    let updatedUser = user;
    if (challenge.purpose === 'email_verify' && user.emailVerified !== true) {
      updatedUser = await this.usersRepo.save({ ...user, emailVerified: true });
    }

    const tokens = await this.issueTokens(updatedUser);
    return { user: this.toSafeUser(updatedUser), ...tokens };
  }

  async requestTwoFaOtp(userId: string, on: boolean) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const code = this.randomOtpCode();
    const codeHash = await bcrypt.hash(code, 10);
    const ttlMs = 10 * 60 * 1000;

    await this.twoFaOtpsRepo
      .createQueryBuilder()
      .update(TwoFaOtpEntity)
      .set({ usedAt: () => 'NOW()' })
      .where('"userId" = :userId AND "usedAt" IS NULL', { userId })
      .execute();

    await this.twoFaOtpsRepo.save(
      this.twoFaOtpsRepo.create({
        id: randomUUID(),
        userId,
        on,
        codeHash,
        expiresAt: new Date(Date.now() + ttlMs),
        usedAt: null,
      }),
    );

    await this.emailService.sendOtp({ to: user.email, code, on });
    return { ok: true };
  }

  async verifyTwoFaOtp(userId: string, on: boolean, code: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const otp = await this.twoFaOtpsRepo.findOne({
      where: { userId, on, usedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (!otp) throw new BadRequestException('OTP not found');
    if (otp.expiresAt.getTime() < Date.now()) throw new BadRequestException('OTP expired');

    const ok = await bcrypt.compare(code, otp.codeHash);
    if (!ok) throw new BadRequestException('Invalid code');

    await this.twoFaOtpsRepo.save({ ...otp, usedAt: new Date() });
    const updated = await this.usersRepo.save({ ...user, twoFaEnabled: on });
    return { user: this.toSafeUser(updated) };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const username = dto.username.toLowerCase().trim();

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const taken = await this.usersRepo.findOne({ where: { username } });
    if (taken) throw new ConflictException('Username already taken');

    const user = await this.usersRepo.save(
      this.usersRepo.create({
        id: randomUUID(),
        email,
        username,
        passwordHash,
        provider: 'password',
      }),
    );

    return this.createChallenge(user, 'email_verify');
  }

  async login(dto: LoginDto) {
    const user = await this.usersRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.provider && user.provider !== 'password') {
      throw new UnauthorizedException('Use Google sign-in for this account');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    if (user.emailVerified !== true) {
      return this.createChallenge(user, 'email_verify');
    }
    if (user.twoFaEnabled === true) {
      return this.createChallenge(user, 'login_2fa');
    }

    const tokens = await this.issueTokens(user);
    return { user: this.toSafeUser(user), ...tokens };
  }

  async googleLogin(idToken: string) {
    const clientId = this.configService.get('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new UnauthorizedException('GOOGLE_CLIENT_ID not configured');
    }

    const client = new OAuth2Client(String(clientId));
    const ticket = await client.verifyIdToken({
      idToken,
      audience: String(clientId),
    });
    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase();
    const sub = payload?.sub;
    if (!email || !sub) throw new UnauthorizedException('Invalid Google token');

    const existing = await this.usersRepo.findOne({ where: { email } });
    const emailVerified = payload?.email_verified === true;

    const user = await this.usersRepo.save(
      this.usersRepo.create({
        ...(existing ?? { id: randomUUID(), email }),
        passwordHash: existing?.passwordHash ?? (await bcrypt.hash(randomUUID(), 10)),
        provider: 'google',
        googleSub: sub,
        displayName: existing?.displayName ?? payload?.name ?? null,
        firstName: existing?.firstName ?? payload?.given_name ?? null,
        lastName: existing?.lastName ?? payload?.family_name ?? null,
        emailVerified: existing?.emailVerified ?? emailVerified,
      }),
    );

    if (user.emailVerified !== true) {
      return this.createChallenge(user, 'email_verify');
    }
    if (user.twoFaEnabled === true) {
      return this.createChallenge(user, 'login_2fa');
    }

    const tokens = await this.issueTokens(user);
    return { user: this.toSafeUser(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    const refreshSecret = String(
      this.configService.get('JWT_REFRESH_SECRET') ?? 'dev_refresh',
    );

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersRepo.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Invalid refresh token');

    const tokens = await this.issueTokens(user);
    return { user: this.toSafeUser(user), ...tokens };
  }

  async forgotPassword(email: string) {
    const user = await this.usersRepo.findOne({ where: { email: email.toLowerCase() } });
    if (!user || (user.provider && user.provider !== 'password')) {
      return { ok: true };
    }

    const token = randomUUID();
    const ttlMs = 15 * 60 * 1000;
    this.passwordResetTokens.set(token, {
      userId: user.id,
      expiresAt: Date.now() + ttlMs,
    });

    return { ok: true, token };
  }

  async resetPassword(token: string, newPassword: string) {
    const entry = this.passwordResetTokens.get(token);
    if (!entry || entry.expiresAt < Date.now()) {
      this.passwordResetTokens.delete(token);
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.usersRepo.findOne({ where: { id: entry.userId } });
    if (!user) throw new UnauthorizedException('Invalid token');

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.provider = 'password';
    await this.usersRepo.save(user);
    this.passwordResetTokens.delete(token);

    const tokens = await this.issueTokens(user);
    return { user: this.toSafeUser(user), ...tokens };
  }

  async setupProfile(userId: string, dto: SetupProfileDto) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    if (dto.username) {
      const normalized = dto.username.toLowerCase();
      const taken = await this.usersRepo.findOne({ where: { username: normalized } });
      if (taken && taken.id !== userId) throw new ConflictException('Username already taken');
    }

    const updated = await this.usersRepo.save({
      ...user,
      username: dto.username ? dto.username.toLowerCase() : user.username,
      displayName: dto.displayName ?? user.displayName,
      firstName: dto.firstName ?? user.firstName,
      lastName: dto.lastName ?? user.lastName,
      gender: dto.gender ?? user.gender,
      birthdate: dto.birthdate ?? user.birthdate,
      bio: dto.bio ?? user.bio,
    });

    return this.toSafeUser(updated);
  }

  async issueTokens(user: UserEntity) {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    const expiresIn = Number(this.configService.get('JWT_EXPIRATION') ?? 3600);
    const refreshExpiresIn = Number(
      this.configService.get('JWT_REFRESH_EXPIRATION') ?? 60 * 60 * 24 * 30,
    );

    const secret = String(this.configService.get('JWT_SECRET') ?? 'dev');
    const refreshSecret = String(
      this.configService.get('JWT_REFRESH_SECRET') ?? 'dev_refresh',
    );

    const accessToken = await this.jwtService.signAsync(payload, {
      secret,
      expiresIn,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  async me(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.toSafeUser(user);
  }

  private toSafeUser(user: UserEntity) {
    const isSetupComplete = Boolean(
      user.displayName &&
        user.username &&
        user.firstName &&
        user.lastName &&
        user.gender &&
        user.birthdate,
    );

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      provider: user.provider ?? 'password',
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      bio: user.bio ?? null,
      firstName: user.firstName,
      lastName: user.lastName,
      gender: user.gender,
      birthdate: user.birthdate,
      twoFaEnabled: user.twoFaEnabled === true,
      emailVerified: user.emailVerified === true,
      profileVerified: user.profileVerified === true,
      isSetupComplete,
    };
  }
}
