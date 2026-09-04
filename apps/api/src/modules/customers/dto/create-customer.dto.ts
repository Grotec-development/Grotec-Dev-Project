import { Type } from 'class-transformer';
import { IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import {
  CropListInputDto,
  LocationListInputDto,
  PhoneListInputDto,
} from './customer-input.dto';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName: string;

  @ValidateNested()
  @Type(() => PhoneListInputDto)
  phones: PhoneListInputDto;

  @ValidateNested()
  @Type(() => LocationListInputDto)
  locations?: LocationListInputDto;

  @ValidateNested()
  @Type(() => CropListInputDto)
  crops?: CropListInputDto;
}
