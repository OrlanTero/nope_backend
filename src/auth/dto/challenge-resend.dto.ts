import { IsString } from 'class-validator';

export class ChallengeResendDto {
  @IsString()
  challengeId!: string;
}
