import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { RolesController } from './roles.controller';

@Module({
  imports: [AuditModule],
  controllers: [EmployeesController, RolesController],
  providers: [EmployeesService],
})
export class EmployeesModule {}
