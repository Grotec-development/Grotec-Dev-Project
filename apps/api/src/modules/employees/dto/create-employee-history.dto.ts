 import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { EmployeeHistoryType } from '@prisma/client';

export class CreateEmployeeHistoryDto {
  @IsEnum(EmployeeHistoryType)
  type: EmployeeHistoryType;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @IsOptional()
  metadata?: any;
}
