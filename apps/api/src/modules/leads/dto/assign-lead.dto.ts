import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AssignLeadDto {
  @IsUUID()
  employeeId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
