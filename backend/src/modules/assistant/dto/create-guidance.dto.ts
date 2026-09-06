import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PROBLEM_TYPES, type ProblemType } from '@grotec/shared';

export class CreateGuidanceDto {
  @IsUUID()
  cropId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MinLength(2, { each: true })
  @MaxLength(80, { each: true })
  problemKeywords: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MinLength(2, { each: true })
  @MaxLength(80, { each: true })
  recommendedProducts: string[];

  @IsOptional()
  @IsIn(PROBLEM_TYPES)
  problemType?: ProblemType;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  usageGuidance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
