"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const auth_guard_1 = require("./common/guards/auth.guard");
const permission_guard_1 = require("./common/guards/permission.guard");
const prisma_module_1 = require("./common/prisma/prisma.module");
const audit_module_1 = require("./modules/audit/audit.module");
const auth_module_1 = require("./modules/auth/auth.module");
const customers_module_1 = require("./modules/customers/customers.module");
const crops_module_1 = require("./modules/crops/crops.module");
const employees_module_1 = require("./modules/employees/employees.module");
const health_module_1 = require("./modules/health/health.module");
const leads_module_1 = require("./modules/leads/leads.module");
const calls_module_1 = require("./modules/calls/calls.module");
const followups_module_1 = require("./modules/followups/followups.module");
const messaging_module_1 = require("./modules/messaging/messaging.module");
const assistant_module_1 = require("./modules/assistant/assistant.module");
const relationship_module_1 = require("./modules/relationship/relationship.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
            prisma_module_1.PrismaModule,
            audit_module_1.AuditModule,
            auth_module_1.AuthModule,
            employees_module_1.EmployeesModule,
            customers_module_1.CustomersModule,
            crops_module_1.CropsModule,
            leads_module_1.LeadsModule,
            calls_module_1.CallsModule,
            followups_module_1.FollowUpsModule,
            messaging_module_1.MessagingModule,
            relationship_module_1.RelationshipModule,
            dashboard_module_1.DashboardModule,
            assistant_module_1.AssistantModule,
            health_module_1.HealthModule,
        ],
        providers: [
            { provide: core_1.APP_GUARD, useClass: auth_guard_1.AuthGuard },
            { provide: core_1.APP_GUARD, useClass: permission_guard_1.PermissionGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map