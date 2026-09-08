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
import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { parsePagination } from '../../common/utils/pagination';
import { NotificationsService } from './notifications.service';
let NotificationsController = class NotificationsController {
    constructor(notifications) {
        this.notifications = notifications;
    }
    async list(actor, isRead, page, pageSize) {
        const isReadBool = isRead === undefined ? undefined : isRead === 'true';
        return this.notifications.list(actor, parsePagination(page, pageSize), isReadBool);
    }
    async getUnreadCount(actor) {
        return this.notifications.getUnreadCount(actor);
    }
    async markAsRead(actor, id) {
        return this.notifications.markAsRead(actor, id);
    }
    async markAllAsRead(actor) {
        return this.notifications.markAllAsRead(actor);
    }
    async runReminders() {
        return this.notifications.processFollowUpReminders();
    }
};
__decorate([
    Get(),
    __param(0, CurrentEmployee()),
    __param(1, Query('isRead')),
    __param(2, Query('page')),
    __param(3, Query('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "list", null);
__decorate([
    Get('unread-count'),
    __param(0, CurrentEmployee()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "getUnreadCount", null);
__decorate([
    Patch(':id/read'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "markAsRead", null);
__decorate([
    Post('mark-all-read'),
    __param(0, CurrentEmployee()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "markAllAsRead", null);
__decorate([
    Post('run-reminders'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "runReminders", null);
NotificationsController = __decorate([
    Controller('notifications'),
    __metadata("design:paramtypes", [typeof (_a = typeof NotificationsService !== "undefined" && NotificationsService) === "function" ? _a : Object])
], NotificationsController);
export { NotificationsController };
