import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MaxLength(200)
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  @MaxLength(200)
  @Matches(/[A-Za-z]/, { message: 'New password must contain a letter' })
  @Matches(/[0-9]/, { message: 'New password must contain a digit' })
  newPassword: string;
}
