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
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DeliveryService } from './delivery.service';

let DeliveryController = class DeliveryController {
    constructor(delivery) {
        this.delivery = delivery;
    }

    async getActiveTrip(actor) {
        return this.delivery.getActiveTripForDriver(actor);
    }

    async updateStopStatus(actor, id, body) {
        return this.delivery.updateStopStatus(actor, id, body);
    }

    async completeDelivery(actor, id, body) {
        return this.delivery.completeDelivery(actor, id, body);
    }

    async createFieldLead(actor, body) {
        return this.delivery.createFieldLead(actor, body);
    }
};

__decorate([
    Get('active-trip'),
    RequirePermission('delivery.read'),
    __param(0, CurrentEmployee()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DeliveryController.prototype, "getActiveTrip", null);

__decorate([
    Patch('stops/:id/status'),
    RequirePermission('delivery.execute'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], DeliveryController.prototype, "updateStopStatus", null);

__decorate([
    Post('stops/:id/complete'),
    RequirePermission('delivery.execute'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], DeliveryController.prototype, "completeDelivery", null);

__decorate([
    Post('field-lead'),
    RequirePermission('delivery.execute'),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], DeliveryController.prototype, "createFieldLead", null);

DeliveryController = __decorate([
    ApiTags('Delivery'),
    ApiBearerAuth(),
    Controller('delivery'),
    __metadata("design:paramtypes", [typeof (_a = typeof DeliveryService !== "undefined" && DeliveryService) === "function" ? _a : Object])
], DeliveryController);

export { DeliveryController };
