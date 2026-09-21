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
import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SegmentsService } from './segments.service';

let SegmentsController = class SegmentsController {
  constructor(segmentsService) {
    this.segmentsService = segmentsService;
  }

  querySegment(actor, filters) {
    return this.segmentsService.querySegment(actor, filters);
  }

  listSegments(actor) {
    return this.segmentsService.listSegments(actor);
  }

  saveSegment(actor, dto) {
    return this.segmentsService.saveSegment(actor, dto);
  }

  deleteSegment(actor, id) {
    return this.segmentsService.deleteSegment(actor, id);
  }

  getTemplates() {
    return this.segmentsService.getTemplates();
  }

  previewCampaign(actor, id, dto) {
    return this.segmentsService.previewCampaign(actor, id, dto);
  }
};

__decorate([
    Post('query'),
    RequirePermission(PERMISSIONS.customerRead),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SegmentsController.prototype, "querySegment", null);

__decorate([
    Get(),
    RequirePermission(PERMISSIONS.customerRead),
    __param(0, CurrentEmployee()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SegmentsController.prototype, "listSegments", null);

__decorate([
    Post(),
    RequirePermission(PERMISSIONS.customerCreate),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SegmentsController.prototype, "saveSegment", null);

__decorate([
    Delete(':id'),
    RequirePermission(PERMISSIONS.customerDeactivate),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SegmentsController.prototype, "deleteSegment", null);

__decorate([
    Get('templates'),
    RequirePermission(PERMISSIONS.customerRead),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SegmentsController.prototype, "getTemplates", null);

__decorate([
    Post(':id/preview-campaign'),
    RequirePermission(PERMISSIONS.customerRead),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SegmentsController.prototype, "previewCampaign", null);

SegmentsController = __decorate([
    Controller('segments'),
    __metadata("design:paramtypes", [typeof (_a = typeof SegmentsService !== "undefined" && SegmentsService) === "function" ? _a : Object])
], SegmentsController);

export { SegmentsController };
