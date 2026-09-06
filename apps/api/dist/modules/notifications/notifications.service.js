"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const api_error_1 = require("../../common/errors/api-error");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const pagination_1 = require("../../common/utils/pagination");
let NotificationsService = class NotificationsService {
    prisma;
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
        return (0, pagination_1.toPage)(items, total, pagination);
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
            throw api_error_1.ApiError.notFound('NOTIFICATION_NOT_FOUND', 'Notification not found');
        if (notification.recipientId !== actor.id) {
            throw api_error_1.ApiError.forbidden('FORBIDDEN', 'Cannot access this notification');
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
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map