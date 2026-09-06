import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateLeadDto {
  @IsUUID()
  customerId: string;

  /** Source taxonomy is provisional until PRD confirmation (open-item #5). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
