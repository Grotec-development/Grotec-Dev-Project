 import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignStaffDto {
  @IsUUID()
  @IsNotEmpty()
  staffEmployeeId: string;
}
