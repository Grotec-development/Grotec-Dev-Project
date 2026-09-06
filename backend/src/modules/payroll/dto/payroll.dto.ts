import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreatePayrollRunDto {
  @IsString()
  month!: string; // YYYY-MM

  @IsOptional()
  @IsString()
  notes?: string;
}

export class GeneratePayrollDto {
  @IsString()
  month!: string; // YYYY-MM

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApprovePayrollDto {
  @IsOptional()
  acknowledgeFlags?: boolean;
}

export class CreateSalaryRevisionDto {
  @IsUUID()
  employeeId!: string;

  @IsString()
  effectiveFrom!: string; // YYYY-MM-DD

  @IsNumber()
  baseSalary!: number;

  @IsObject()
  components!: {
    basic: number;
    hra?: number;
    allowances?: number;
    pf?: number;
    esi?: number;
    tds?: number;
    otherDeductions?: number;
    [key: string]: any;
  };

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateAdvanceDto {
  @IsUUID()
  employeeId!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  linkedMonth?: string; // YYYY-MM
}
