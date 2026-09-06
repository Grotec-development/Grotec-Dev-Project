import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class PlaceCallDto {
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  phoneNumber: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  leadId?: string;
}