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
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SupportTicketsService } from './support-tickets.service';

let SupportTicketsController = class SupportTicketsController {
    constructor(tickets) {
        this.tickets = tickets;
    }

    async list(actor, query) {
        return this.tickets.list(actor, query);
    }

    async summary(actor) {
        return this.tickets.getSummary(actor);
    }

    async getById(actor, id) {
        return this.tickets.getById(actor, id);
    }

    async create(actor, body) {
        return this.tickets.create(actor, body);
    }

    async assign(actor, id, body) {
        return this.tickets.assign(actor, id, body);
    }

    async updateStatus(actor, id, body) {
        return this.tickets.updateStatus(actor, id, body);
    }

    async escalate(actor, id, body) {
        return this.tickets.escalateTicket(actor, id, body);
    }
};

__decorate([
    Get(),
    __param(0, CurrentEmployee()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SupportTicketsController.prototype, "list", null);

__decorate([
    Get('summary'),
    __param(0, CurrentEmployee()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SupportTicketsController.prototype, "summary", null);

__decorate([
    Get(':id'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SupportTicketsController.prototype, "getById", null);

__decorate([
    Post(),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SupportTicketsController.prototype, "create", null);

__decorate([
    Patch(':id/assign'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], SupportTicketsController.prototype, "assign", null);

__decorate([
    Patch(':id/status'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], SupportTicketsController.prototype, "updateStatus", null);

__decorate([
    Post(':id/escalate'),
    HttpCode(200),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], SupportTicketsController.prototype, "escalate", null);

SupportTicketsController = __decorate([
    Controller('support-tickets'),
    __metadata("design:paramtypes", [SupportTicketsService])
], SupportTicketsController);

export { SupportTicketsController };
