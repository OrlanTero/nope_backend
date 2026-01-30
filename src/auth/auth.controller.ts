import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetupProfileDto } from './dto/setup-profile.dto';
import { ChallengeResendDto } from './dto/challenge-resend.dto';
import { ChallengeVerifyDto } from './dto/challenge-verify.dto';
import { TwoFaRequestDto } from './dto/twofa-request.dto';
import { TwoFaVerifyDto } from './dto/twofa-verify.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

type AuthedRequest = Request & { user: { userId: string; email: string } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  google(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto.idToken);
  }

  @Post('challenge/verify')
  verifyChallenge(@Body() dto: ChallengeVerifyDto) {
    return this.authService.verifyChallenge(dto.challengeId, dto.code);
  }

  @Post('challenge/resend')
  resendChallenge(@Body() dto: ChallengeResendDto) {
    return this.authService.resendChallenge(dto.challengeId);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthedRequest) {
    const user = req.user;
    return this.authService.me(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('setup')
  setup(@Req() req: AuthedRequest, @Body() dto: SetupProfileDto) {
    return this.authService.setupProfile(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@Req() req: AuthedRequest, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.userId, dto.currentPassword, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'avatar', maxCount: 1 }], {
      storage: memoryStorage(),
      limits: { fileSize: 1024 * 1024 * 10, files: 1 },
    }),
  )
  updateProfile(
    @Req() req: AuthedRequest,
    @Body() dto: UpdateProfileDto,
    @UploadedFiles() files: { avatar?: Express.Multer.File[] },
  ) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.authService.updateProfile(req.user.userId, dto, files?.avatar?.[0], baseUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/request')
  request2fa(@Req() req: AuthedRequest, @Body() dto: TwoFaRequestDto) {
    return this.authService.requestTwoFaOtp(req.user.userId, dto.on);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/verify')
  verify2fa(@Req() req: AuthedRequest, @Body() dto: TwoFaVerifyDto) {
    return this.authService.verifyTwoFaOtp(req.user.userId, dto.on, dto.code);
  }
}
