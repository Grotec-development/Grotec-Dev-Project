import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const CROP_CATEGORIES = ['FIELD', 'TREE', 'PLANTATION', 'VEGETABLE', 'OTHER'] as const;

export class UpdateCropDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  localName?: string | null;

  @IsOptional()
  @IsIn(CROP_CATEGORIES)
  category?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
