import { PartialType } from '@nestjs/swagger';
import { LocationInputDto } from './customer-input.dto';

export class UpdateLocationDto extends PartialType(LocationInputDto) {}
