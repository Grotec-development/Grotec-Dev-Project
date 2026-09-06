import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ApplyLeaveDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsUUID()
  leaveTypeId!: string;

  @IsString()
  startDate!: string; // YYYY-MM-DD

  @IsString()
  endDate!: string; // YYYY-MM-DD

  @IsNumber()
  daysCount!: number;

  @IsString()
  reason!: string;
}

export class RejectLeaveDto {
  @IsString()
  reason!: string;
}

export class CreateLeaveTypeDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  quotaDays!: number;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsBoolean()
  allowCarryForward?: boolean;
}
