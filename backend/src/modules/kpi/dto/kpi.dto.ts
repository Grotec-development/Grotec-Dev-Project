import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { KpiMetricType } from '@grotec/shared';

export class UpsertKpiTargetDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  roleCode?: string;

  @IsOptional()
  @IsString()
  team?: string;

  @IsString()
  period!: string; // YYYY-MM

  @IsEnum(KpiMetricType)
  metric!: KpiMetricType;

  @IsNumber()
  targetValue!: number;

  @IsOptional()
  @IsNumber()
  weight?: number;
}

export class FreezeKpiScoreDto {
  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsString()
  reviewNotes?: string;

  @IsOptional()
  @IsString()
  coachingActions?: string;
}

export class ComputeKpiDto {
  @IsString()
  period!: string; // YYYY-MM
}

export class CreateKpiReviewEntryDto {
  @IsOptional()
  @IsUUID()
  periodScoreId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  period?: string;

  @IsString()
  body!: string;
}
