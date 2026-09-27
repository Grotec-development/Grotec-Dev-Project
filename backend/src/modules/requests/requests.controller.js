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
import { parsePagination } from '../../common/utils/pagination';
import { CreateEmployeeRequestDto, UpdateEmployeeRequestStatusDto } from './dto/request.dto';
import { RequestsService } from './requests.service';
let RequestsController = class RequestsController {
    constructor(requests) {
        this.requests = requests;
    }
    async create(actor, dto) {
        return this.requests.create(actor, dto);
    }
    async listMine(actor, status, page, pageSize) {
        return this.requests.listMine(actor, parsePagination(page, pageSize), { status });
    }
    async inbox(actor, status, type, page, pageSize) {
        return this.requests.inbox(actor, parsePagination(page, pageSize), { status, type });
    }
    async updateStatus(actor, id, dto) {
        return this.requests.updateStatus(actor, id, dto);
    }
};
__decorate([
    Post(),
    RequirePermission(PERMISSIONS.requestCreate),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateEmployeeRequestDto]),
    __metadata("design:returntype", Promise)
], RequestsController.prototype, "create", null);
__decorate([
    Get('my'),
    RequirePermission(PERMISSIONS.requestCreate),
    __param(0, CurrentEmployee()),
    __param(1, Query('status')),
    __param(2, Query('page')),
    __param(3, Query('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], RequestsController.prototype, "listMine", null);
__decorate([
    Get(),
    RequirePermission(PERMISSIONS.requestManage),
    __param(0, CurrentEmployee()),
    __param(1, Query('status')),
    __param(2, Query('type')),
    __param(3, Query('page')),
    __param(4, Query('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], RequestsController.prototype, "inbox", null);
__decorate([
    Patch(':id/status'),
    RequirePermission(PERMISSIONS.requestManage),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UpdateEmployeeRequestStatusDto]),
    __metadata("design:returntype", Promise)
], RequestsController.prototype, "updateStatus", null);
RequestsController = __decorate([
    Controller('requests'),
    __metadata("design:paramtypes", [typeof (_a = typeof RequestsService !== "undefined" && RequestsService) === "function" ? _a : Object])
], RequestsController);
export { RequestsController };
