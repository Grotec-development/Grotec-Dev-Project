import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { AttendanceStatus } from '@grotec/shared';

export class MarkAttendanceDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsString()
  date!: string; // YYYY-MM-DD

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsString()
  punchIn?: string;

  @IsOptional()
  @IsString()
  punchOut?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkAttendanceItemDto {
  @IsUUID()
  employeeId!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsString()
  punchIn?: string;

  @IsOptional()
  @IsString()
  punchOut?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkAttendanceDto {
  @IsString()
  date!: string; // YYYY-MM-DD

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkAttendanceItemDto)
  records!: BulkAttendanceItemDto[];
}

export class RejectAttendanceDto {
  @IsString()
  reason!: string;
}

export class EsslPunchDto {
  @IsString()
  deviceCode!: string;

  @IsString()
  biometricPin!: string;

  @IsString()
  punchTime!: string; // ISO

  @IsOptional()
  @IsString()
  punchType?: string; // IN or OUT
}

export class SyncEsslDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EsslPunchDto)
  punches?: EsslPunchDto[];

  @IsOptional()
  @IsString()
  date?: string; // Optional target date for simulation
}

export class CreateEsslDeviceDto {
  @IsString()
  deviceCode!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  location?: string;
}

export class CreateEsslMappingDto {
  @IsUUID()
  employeeId!: string;

  @IsUUID()
  deviceId!: string;

  @IsString()
  biometricPin!: string;
}

export class CorrectAttendanceDto {
  @IsOptional()
  @IsString()
  punchIn?: string;

  @IsOptional()
  @IsString()
  punchOut?: string;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @IsString()
  reason!: string;
}

export class EsslWebhookPunchDto {
  @IsString()
  externalBiometricId!: string;

  @IsString()
  punchAt!: string;

  @IsOptional()
  @IsString()
  punchType?: string;
}

export class EsslWebhookDto {
  @IsString()
  deviceId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EsslWebhookPunchDto)
  punches!: EsslWebhookPunchDto[];
}
