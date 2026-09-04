"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadsModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../../common/audit/audit.module");
const leads_controller_1 = require("./leads.controller");
const leads_service_1 = require("./leads.service");
let LeadsModule = class LeadsModule {
};
exports.LeadsModule = LeadsModule;
exports.LeadsModule = LeadsModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_module_1.AuditModule],
        controllers: [leads_controller_1.LeadsController],
        providers: [leads_service_1.LeadsService],
    })
], LeadsModule);
//# sourceMappingURL=leads.module.js.map