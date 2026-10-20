var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a, _b, _c;
import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AiCallingService } from './ai-calling.service';
import { StartAiCallDto } from './dto/start-ai-call.dto';
import { ConfirmAiOrderDto } from './dto/confirm-ai-order.dto';

let AiCallingController = class AiCallingController {
  constructor(aiCallingService) {
    this.aiCallingService = aiCallingService;
  }

  getConfig() {
    return this.aiCallingService.getConfig();
  }

  getFarmers(query) {
    return this.aiCallingService.getEligibleFarmers(query);
  }

  startCall(actor, dto) {
    return this.aiCallingService.startCall(actor, dto);
  }

  getCallStatus(id, actor) {
    return this.aiCallingService.getCallStatus(id, actor);
  }

  completeCall(id, actor, body) {
    return this.aiCallingService.completeCall(id, actor, body);
  }

  handleWebhook(customSecret, authHeader, payload) {
    return this.aiCallingService.handleVapiWebhook(customSecret || authHeader, payload);
  }

  confirmOrder(actor, dto) {
    return this.aiCallingService.confirmOrder(actor, dto);
  }

  getCallHistory(actor) {
    return this.aiCallingService.getCallHistory(actor);
  }
};

__decorate([
  Get('config'),
  RequirePermission(PERMISSIONS.callRead),
  __metadata("design:type", Function),
  __metadata("design:paramtypes", []),
  __metadata("design:returntype", void 0)
], AiCallingController.prototype, "getConfig", null);

__decorate([
  Get('farmers'),
  RequirePermission(PERMISSIONS.callRead),
  __param(0, Query()),
  __metadata("design:type", Function),
  __metadata("design:paramtypes", [Object]),
  __metadata("design:returntype", void 0)
], AiCallingController.prototype, "getFarmers", null);

__decorate([
  Post('call'),
  RequirePermission(PERMISSIONS.callRead),
  __param(0, CurrentEmployee()),
  __param(1, Body()),
  __metadata("design:type", Function),
  __metadata("design:paramtypes", [Object, typeof (_b = typeof StartAiCallDto !== "undefined" && StartAiCallDto) === "function" ? _b : Object]),
  __metadata("design:returntype", void 0)
], AiCallingController.prototype, "startCall", null);

__decorate([
  Get('call/:id'),
  RequirePermission(PERMISSIONS.callRead),
  __param(0, Param('id')),
  __param(1, CurrentEmployee()),
  __metadata("design:type", Function),
  __metadata("design:paramtypes", [String, Object]),
  __metadata("design:returntype", void 0)
], AiCallingController.prototype, "getCallStatus", null);

__decorate([
  Post('call/:id/complete'),
  RequirePermission(PERMISSIONS.callRead),
  __param(0, Param('id')),
  __param(1, CurrentEmployee()),
  __param(2, Body()),
  __metadata("design:type", Function),
  __metadata("design:paramtypes", [String, Object, Object]),
  __metadata("design:returntype", void 0)
], AiCallingController.prototype, "completeCall", null);

__decorate([
  Public(),
  Post('webhook'),
  __param(0, Headers('x-vapi-secret')),
  __param(1, Headers('authorization')),
  __param(2, Body()),
  __metadata("design:type", Function),
  __metadata("design:paramtypes", [String, String, Object]),
  __metadata("design:returntype", void 0)
], AiCallingController.prototype, "handleWebhook", null);

__decorate([
  Post('confirm-order'),
  RequirePermission(PERMISSIONS.callRead),
  __param(0, CurrentEmployee()),
  __param(1, Body()),
  __metadata("design:type", Function),
  __metadata("design:paramtypes", [Object, typeof (_c = typeof ConfirmAiOrderDto !== "undefined" && ConfirmAiOrderDto) === "function" ? _c : Object]),
  __metadata("design:returntype", void 0)
], AiCallingController.prototype, "confirmOrder", null);

__decorate([
  Get('history'),
  RequirePermission(PERMISSIONS.callRead),
  __param(0, CurrentEmployee()),
  __metadata("design:type", Function),
  __metadata("design:paramtypes", [Object]),
  __metadata("design:returntype", void 0)
], AiCallingController.prototype, "getCallHistory", null);

AiCallingController = __decorate([
  Controller('ai-calling'),
  __metadata("design:paramtypes", [typeof (_a = typeof AiCallingService !== "undefined" && AiCallingService) === "function" ? _a : Object]),
], AiCallingController);

export { AiCallingController };
