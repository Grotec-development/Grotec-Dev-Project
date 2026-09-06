import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PhoneKind } from '@prisma/client';

export class UpdatePhoneDto {
  @IsOptional()
  @IsEnum(PhoneKind)
  kind?: PhoneKind;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
