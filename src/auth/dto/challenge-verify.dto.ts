import { IsString, Length } from 'class-validator';

export class ChallengeVerifyDto {
  @IsString()
  challengeId!: string;

  @IsString()
  @Length(4, 10)
  code!: string;
}
