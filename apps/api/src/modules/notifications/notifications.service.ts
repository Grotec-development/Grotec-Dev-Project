import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PageParams, toPage } from '../../common/utils/pagination';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    actor: AuthEmployee,
    pagination: PageParams,
    isRead?: boolean,
  ): Promise<any> {
    const where: Prisma.AppNotificationWhereInput = {
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

  async getUnreadCount(actor: AuthEmployee) {
    const count = await this.prisma.appNotification.count({
      where: { recipientId: actor.id, isRead: false },
    });
    return { unreadCount: count };
  }

  async markAsRead(actor: AuthEmployee, id: string) {
    const notification = await this.prisma.appNotification.findUnique({
      where: { id },
    });
    if (!notification) throw ApiError.notFound('NOTIFICATION_NOT_FOUND', 'Notification not found');
    if (notification.recipientId !== actor.id) {
      throw ApiError.forbidden('FORBIDDEN', 'Cannot access this notification');
    }

    return this.prisma.appNotification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(actor: AuthEmployee) {
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
}
