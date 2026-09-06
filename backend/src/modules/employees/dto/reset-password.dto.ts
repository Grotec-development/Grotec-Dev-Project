import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  /** When omitted, a temporary password is generated and returned once. */
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(200)
  @Matches(/[A-Za-z]/, { message: 'Password must contain a letter' })
  @Matches(/[0-9]/, { message: 'Password must contain a digit' })
  newPassword?: string;
}
