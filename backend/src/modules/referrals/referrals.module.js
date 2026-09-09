var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { CustomersModule } from '../customers/customers.module';
import { LeadsModule } from '../leads/leads.module';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
let ReferralsModule = class ReferralsModule {
};
ReferralsModule = __decorate([
    Module({
        // CustomersModule/LeadsModule are imported for their existing authorization
        // services (assertVisible / detailOrThrow) — not reimplemented here.
        imports: [AuditModule, CustomersModule, LeadsModule],
        controllers: [ReferralsController],
        providers: [ReferralsService],
    })
], ReferralsModule);
export { ReferralsModule };
