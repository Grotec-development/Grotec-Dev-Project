import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { parsePagination } from '../../common/utils/pagination';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @CurrentEmployee() actor: AuthEmployee,
    @Query('isRead') isRead?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const isReadBool = isRead === undefined ? undefined : isRead === 'true';
    return this.notifications.list(actor, parsePagination(page, pageSize), isReadBool);
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentEmployee() actor: AuthEmployee) {
    return this.notifications.getUnreadCount(actor);
  }

  @Patch(':id/read')
  async markAsRead(@CurrentEmployee() actor: AuthEmployee, @Param('id') id: string) {
    return this.notifications.markAsRead(actor, id);
  }

  @Post('mark-all-read')
  async markAllAsRead(@CurrentEmployee() actor: AuthEmployee) {
    return this.notifications.markAllAsRead(actor);
  }

  @Post('run-reminders')
  async runReminders() {
    return this.notifications.processFollowUpReminders();
  }
}
