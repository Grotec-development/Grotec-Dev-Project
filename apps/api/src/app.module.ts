import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './common/guards/auth.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { CropsModule } from './modules/crops/crops.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { HealthModule } from './modules/health/health.module';
import { LeadsModule } from './modules/leads/leads.module';
import { CallsModule } from './modules/calls/calls.module';
import { FollowUpsModule } from './modules/followups/followups.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { RelationshipModule } from './modules/relationship/relationship.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { LeaveModule } from './modules/leave/leave.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { KpiModule } from './modules/kpi/kpi.module';
import { HrmsDashboardModule } from './modules/hrms-dashboard/hrms-dashboard.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['apps/api/.env', '.env'] }),
    // Global modules must precede modules that depend on them.
    PrismaModule,
    AuditModule,
    AuthModule,
    EmployeesModule,
    CustomersModule,
    CropsModule,
    LeadsModule,
    CallsModule,
    FollowUpsModule,
    MessagingModule,
    RelationshipModule,
    DashboardModule,
    AssistantModule,
    AttendanceModule,
    LeaveModule,
    PayrollModule,
    KpiModule,
    HrmsDashboardModule,
    NotificationsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule {}
