var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditModule } from '../../common/audit/audit.module';
import { SegmentsController } from './segments.controller';
import { SegmentsService } from './segments.service';

let SegmentsModule = class SegmentsModule {};

SegmentsModule = __decorate([
  Module({
    imports: [PrismaModule, AuditModule],
    controllers: [SegmentsController],
    providers: [SegmentsService],
    exports: [SegmentsService],
  })
], SegmentsModule);

export { SegmentsModule };
