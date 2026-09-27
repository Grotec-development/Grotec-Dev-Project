var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FollowUpReminderScheduler_1;
var _a, _b;
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
/**
 * Sends follow-up reminders on a timer so they fire without anyone calling
 * POST /notifications/run-reminders. Interval (ms) is FOLLOW_UP_REMINDER_MS,
 * default 5 minutes; <= 0 disables it. Off under Vitest so unit and e2e runs
 * stay deterministic. Safe with several instances: sending is claim-first.
 */
let FollowUpReminderScheduler = FollowUpReminderScheduler_1 = class FollowUpReminderScheduler {
    constructor(notifications, config) {
        this.notifications = notifications;
        this.config = config;
        this.logger = new Logger(FollowUpReminderScheduler_1.name);
        this.timer = null;
        this.running = false;
    }
    onModuleInit() {
        if (process.env.VITEST)
            return;
        const raw = this.config.get('FOLLOW_UP_REMINDER_MS');
        const intervalMs = raw === undefined || raw === '' ? DEFAULT_INTERVAL_MS : Number(raw);
        if (!Number.isFinite(intervalMs) || intervalMs <= 0)
            return;
        this.timer = setInterval(() => void this.tick(), intervalMs);
        this.timer.unref?.();
    }
    onApplicationShutdown() {
        if (this.timer)
            clearInterval(this.timer);
    }
    async tick() {
        if (this.running)
            return; // previous run still going
        this.running = true;
        try {
            const { sent } = await this.notifications.processFollowUpReminders();
            if (sent > 0)
                this.logger.log(`sent ${sent} follow-up reminder(s)`);
        }
        catch (error) {
            this.logger.error(`follow-up reminder run failed: ${String(error)}`);
        }
        finally {
            this.running = false;
        }
    }
};
FollowUpReminderScheduler = FollowUpReminderScheduler_1 = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof NotificationsService !== "undefined" && NotificationsService) === "function" ? _a : Object, typeof (_b = typeof ConfigService !== "undefined" && ConfigService) === "function" ? _b : Object])
], FollowUpReminderScheduler);
export { FollowUpReminderScheduler };
