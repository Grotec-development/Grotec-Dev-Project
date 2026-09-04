import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCropDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  localName?: string;
}
