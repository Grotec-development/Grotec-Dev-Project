"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallsModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../../common/audit/audit.module");
const prisma_module_1 = require("../../common/prisma/prisma.module");
const customers_module_1 = require("../customers/customers.module");
const messaging_module_1 = require("../messaging/messaging.module");
const call_history_controller_1 = require("./call-history.controller");
const call_status_sync_service_1 = require("./call-status-sync.service");
const calls_controller_1 = require("./calls.controller");
const calls_service_1 = require("./calls.service");
const dialer_webhook_controller_1 = require("./dialer-webhook.controller");
const dialer_registry_1 = require("./dialer/dialer.registry");
let CallsModule = class CallsModule {
};
exports.CallsModule = CallsModule;
exports.CallsModule = CallsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_module_1.AuditModule, customers_module_1.CustomersModule, messaging_module_1.MessagingModule],
        controllers: [calls_controller_1.CallsController, call_history_controller_1.CustomerCallsController, dialer_webhook_controller_1.DialerWebhookController],
        providers: [dialer_registry_1.DialerRegistry, call_status_sync_service_1.CallStatusSyncService, calls_service_1.CallsService],
    })
], CallsModule);
//# sourceMappingURL=calls.module.js.map