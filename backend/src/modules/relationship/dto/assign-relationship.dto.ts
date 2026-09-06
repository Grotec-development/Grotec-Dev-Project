import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AssignRelationshipDto {
  @IsUUID()
  employeeId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ReleaseRelationshipDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason?: string;
}
