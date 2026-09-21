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
var _a;
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CallOutcomeMasterService } from './call-outcome-master.service';

let CallOutcomeMasterController = class CallOutcomeMasterController {
  constructor(outcomeService) {
    this.outcomeService = outcomeService;
  }

  list(actor, query) {
    return this.outcomeService.list(actor, query);
  }

  create(actor, dto) {
    return this.outcomeService.create(actor, dto);
  }

  update(actor, id, dto) {
    return this.outcomeService.update(id, actor, dto);
  }
};

__decorate([
    Get(),
    RequirePermission(PERMISSIONS.callRead),
    __param(0, CurrentEmployee()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CallOutcomeMasterController.prototype, "list", null);

__decorate([
    Post(),
    RequirePermission(PERMISSIONS.callManage),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CallOutcomeMasterController.prototype, "create", null);

__decorate([
    Patch(':id'),
    RequirePermission(PERMISSIONS.callManage),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], CallOutcomeMasterController.prototype, "update", null);

CallOutcomeMasterController = __decorate([
    Controller('call-outcomes'),
    __metadata("design:paramtypes", [typeof (_a = typeof CallOutcomeMasterService !== "undefined" && CallOutcomeMasterService) === "function" ? _a : Object])
], CallOutcomeMasterController);

export { CallOutcomeMasterController };
