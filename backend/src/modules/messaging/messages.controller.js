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

@ApiTags('Messages & Notifications')
@ApiBearerAuth()
@Controller('messages')
export class MessagesController {
    constructor(messaging) {
        this.messaging = messaging;
    }

    @Post('sms')
    @ApiOperation({ summary: 'Dispatch SMS via Exotel Phone Messages API' })
    @RequirePermission(PERMISSIONS.callManage)
    async sendSms(@CurrentEmployee() actor, @Body() dto) {
        return this.messaging.sendSms(actor, dto);
    }

    @Post('whatsapp')
    @ApiOperation({ summary: 'Dispatch WhatsApp message via WhatsApp Cloud/Business API' })
    @RequirePermission(PERMISSIONS.callManage)
    async sendWhatsApp(@CurrentEmployee() actor, @Body() dto) {
        return this.messaging.sendWhatsApp(actor, dto);
    }

    @Post('email')
    @ApiOperation({ summary: 'Dispatch Email notification via SMTP Transporter' })
    @RequirePermission(PERMISSIONS.customerRead)
    async sendEmail(@CurrentEmployee() actor, @Body() dto) {
        return this.messaging.sendEmail(actor, dto);
    }

    @Get('outbox')
    @ApiOperation({ summary: 'List outbound messages history across SMS, WhatsApp, and email' })
    @RequirePermission(PERMISSIONS.callRead)
    async listOutbox(
        @CurrentEmployee() actor,
        @Query('status') status,
        @Query('customerId') customerId,
        @Query('phone') phone,
        @Query('provider') provider,
        @Query('page') page,
        @Query('pageSize') pageSize,
    ) {
        return this.messaging.listOutbound(actor, parsePagination(page, pageSize), {
            status,
            customerId,
            recipientPhone: phone,
            provider,
        });
    }

    @Get('status')
    @ApiOperation({ summary: 'Check connectivity status of Exotel SMS, WhatsApp API, and SMTP Email' })
    @RequirePermission(PERMISSIONS.callRead)
    async getStatus() {
        return this.messaging.getProviderStatus();
    }

    @Post('resend/:id')
    @ApiOperation({ summary: 'Retry delivering a queued or failed outbound message' })
    @RequirePermission(PERMISSIONS.callManage)
    async resend(@CurrentEmployee() actor, @Param('id') id) {
        return this.messaging.deliver(id);
    }
}

MessagesController = __decorate([
    Controller('messages'),
    __metadata("design:paramtypes", [typeof (_a = typeof MessagingService !== "undefined" && MessagingService) === "function" ? _a : Object])
], MessagesController);
