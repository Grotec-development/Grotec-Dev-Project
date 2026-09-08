var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
import { Injectable } from '@nestjs/common';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toPage } from '../../common/utils/pagination';
let NotificationsService = class NotificationsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(actor, pagination, isRead) {
        const where = {
            recipientId: actor.id,
            ...(isRead !== undefined ? { isRead } : {}),
        };
        const [total, items] = await Promise.all([
            this.prisma.appNotification.count({ where }),
            this.prisma.appNotification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (pagination.page - 1) * pagination.pageSize,
                take: pagination.pageSize,
            }),
        ]);
        return toPage(items, total, pagination);
    }
    async getUnreadCount(actor) {
        const count = await this.prisma.appNotification.count({
            where: { recipientId: actor.id, isRead: false },
        });
        return { unreadCount: count };
    }
    async markAsRead(actor, id) {
        const notification = await this.prisma.appNotification.findUnique({
            where: { id },
        });
        if (!notification)
            throw ApiError.notFound('NOTIFICATION_NOT_FOUND', 'Notification not found');
        if (notification.recipientId !== actor.id) {
            throw ApiError.forbidden('FORBIDDEN', 'Cannot access this notification');
        }
        return this.prisma.appNotification.update({
            where: { id },
            data: { isRead: true },
        });
    }
    async markAllAsRead(actor) {
        await this.prisma.appNotification.updateMany({
            where: { recipientId: actor.id, isRead: false },
            data: { isRead: true },
        });
        return { success: true };
    }
    async processFollowUpReminders() {
        const now = new Date();
        const dueFollowUps = await this.prisma.followUp.findMany({
            where: {
                dueAt: { lte: now },
                status: 'PENDING',
                reminderSentAt: null,
            },
            include: {
                customer: { select: { fullName: true } },
            },
        });
        let sent = 0;
        for (const f of dueFollowUps) {
            await this.prisma.$transaction(async (tx) => {
                await tx.appNotification.create({
                    data: {
                        recipientId: f.agentId,
                        type: 'FOLLOW_UP_REMINDER',
                        title: 'Follow-up Due',
                        message: `Follow-up with ${f.customer.fullName} is due now.`,
                        data: { followUpId: f.id, customerId: f.customerId },
                    },
                });
                await tx.followUp.update({
                    where: { id: f.id },
                    data: { reminderSentAt: new Date() },
                });
            });
            sent++;
        }
        return { sent };
    }
};
NotificationsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object])
], NotificationsService);
export { NotificationsService };
