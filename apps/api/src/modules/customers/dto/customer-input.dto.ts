import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PhoneKind } from '@prisma/client';

export class PhoneInputDto {
  /** Raw number as entered by the user — normalized server-side (E.164). */
  @IsString()
  @MaxLength(30)
  number: string;

  @IsOptional()
  @IsEnum(PhoneKind)
  kind?: PhoneKind;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class LocationInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  addressLine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  taluk?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  village?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pincode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CropInputDto {
  @IsUUID()
  cropId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  acreage: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class PhoneListInputDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => PhoneInputDto)
  phones: PhoneInputDto[];
}

export class LocationListInputDto {
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => LocationInputDto)
  locations: LocationInputDto[];
}

export class CropListInputDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CropInputDto)
  crops: CropInputDto[];
}
