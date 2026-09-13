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
var _a, _b, _c, _d;
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { parsePagination } from '../../common/utils/pagination';
import { MessagingService } from './messaging.service';
import { SendSmsDto } from './dto/send-sms.dto';
import { SendWhatsAppDto } from './dto/send-whatsapp.dto';
import { SendEmailDto } from './dto/send-email.dto';

let MessagesController = class MessagesController {
    constructor(messaging) {
        this.messaging = messaging;
    }

    async sendSms(actor, dto) {
        return this.messaging.sendSms(actor, dto);
    }

    async sendWhatsApp(actor, dto) {
        return this.messaging.sendWhatsApp(actor, dto);
    }

    async sendEmail(actor, dto) {
        return this.messaging.sendEmail(actor, dto);
    }

    async listOutbox(actor, status, customerId, phone, provider, page, pageSize) {
        return this.messaging.listOutbound(actor, parsePagination(page, pageSize), {
            status,
            customerId,
            recipientPhone: phone,
            provider,
        });
    }

    async getStatus() {
        return this.messaging.getProviderStatus();
    }

    async resend(actor, id) {
        return this.messaging.deliver(id);
    }
};

__decorate([
    Post('sms'),
    ApiOperation({ summary: 'Dispatch SMS via Exotel Phone Messages API' }),
    RequirePermission(PERMISSIONS.callManage),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_b = typeof SendSmsDto !== "undefined" && SendSmsDto) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "sendSms", null);

__decorate([
    Post('whatsapp'),
    ApiOperation({ summary: 'Dispatch WhatsApp message via WhatsApp Cloud/Business API' }),
    RequirePermission(PERMISSIONS.callManage),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_c = typeof SendWhatsAppDto !== "undefined" && SendWhatsAppDto) === "function" ? _c : Object]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "sendWhatsApp", null);

__decorate([
    Post('email'),
    ApiOperation({ summary: 'Dispatch Email notification via SMTP Transporter' }),
    RequirePermission(PERMISSIONS.customerRead),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_d = typeof SendEmailDto !== "undefined" && SendEmailDto) === "function" ? _d : Object]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "sendEmail", null);

__decorate([
    Get('outbox'),
    ApiOperation({ summary: 'List outbound messages history across SMS, WhatsApp, and email' }),
    RequirePermission(PERMISSIONS.callRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('status')),
    __param(2, Query('customerId')),
    __param(3, Query('phone')),
    __param(4, Query('provider')),
    __param(5, Query('page')),
    __param(6, Query('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "listOutbox", null);

__decorate([
    Get('status'),
    ApiOperation({ summary: 'Check connectivity status of Exotel SMS, WhatsApp API, and SMTP Email' }),
    RequirePermission(PERMISSIONS.callRead),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "getStatus", null);

__decorate([
    Post('resend/:id'),
    ApiOperation({ summary: 'Retry delivering a queued or failed outbound message' }),
    RequirePermission(PERMISSIONS.callManage),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "resend", null);

MessagesController = __decorate([
    ApiTags('Messages & Notifications'),
    ApiBearerAuth(),
    Controller('messages'),
    __metadata("design:paramtypes", [typeof (_a = typeof MessagingService !== "undefined" && MessagingService) === "function" ? _a : Object])
], MessagesController);

export { MessagesController };
