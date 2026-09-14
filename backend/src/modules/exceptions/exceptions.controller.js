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
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ExceptionsService } from './exceptions.service';

let ExceptionsController = class ExceptionsController {
    constructor(exceptions) {
        this.exceptions = exceptions;
    }

    async requestQuantityException(actor, body) {
        return this.exceptions.requestQuantityException(actor, body);
    }

    async listPendingExceptions(actor) {
        return this.exceptions.listPendingExceptions(actor);
    }

    async reviewException(actor, id, body) {
        return this.exceptions.reviewException(actor, id, body);
    }
};

__decorate([
    Post('quantity'),
    RequirePermission('delivery.execute'),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExceptionsController.prototype, "requestQuantityException", null);

__decorate([
    Get('pending'),
    RequirePermission('exceptions.manage'),
    __param(0, CurrentEmployee()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExceptionsController.prototype, "listPendingExceptions", null);

__decorate([
    Post(':id/review'),
    RequirePermission('exceptions.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ExceptionsController.prototype, "reviewException", null);

ExceptionsController = __decorate([
    ApiTags('Exceptions'),
    ApiBearerAuth(),
    Controller('exceptions'),
    __metadata("design:paramtypes", [typeof (_a = typeof ExceptionsService !== "undefined" && ExceptionsService) === "function" ? _a : Object])
], ExceptionsController);

export { ExceptionsController };
