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
import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ReportsService } from './reports.service';

/**
 * Controller exposing authentic CRM operational reports, CSV exports,
 * and the telecaller operational leaderboard.
 * Guarded strictly by RBAC permissions and service-level data scoping.
 */
let ReportsController = class ReportsController {
    constructor(reports) {
        this.reports = reports;
    }

    // -------------------------------------------------------------------------
    // CALL ACTIVITY REPORT
    // -------------------------------------------------------------------------

    async getCalls(actor, query) {
        return this.reports.getCallReport(actor, query || {});
    }

    async exportCalls(actor, query, res) {
        const { filename, csv } = await this.reports.exportCallsCsv(actor, query || {});
        res?.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return csv;
    }

    // -------------------------------------------------------------------------
    // FOLLOW-UP DISCIPLINE REPORT
    // -------------------------------------------------------------------------

    async getFollowUps(actor, query) {
        return this.reports.getFollowUpReport(actor, query || {});
    }

    async exportFollowUps(actor, query, res) {
        const { filename, csv } = await this.reports.exportFollowUpsCsv(actor, query || {});
        res?.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return csv;
    }

    // -------------------------------------------------------------------------
    // FARMER / CUSTOMER MASTER REPORT
    // -------------------------------------------------------------------------

    async getCustomers(actor, query) {
        return this.reports.getCustomerReport(actor, query || {});
    }

    async exportCustomers(actor, query, res) {
        const { filename, csv } = await this.reports.exportCustomersCsv(actor, query || {});
        res?.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return csv;
    }

    // -------------------------------------------------------------------------
    // LEADS PIPELINE REPORT
    // -------------------------------------------------------------------------

    async getLeads(actor, query) {
        return this.reports.getLeadReport(actor, query || {});
    }

    async exportLeads(actor, query, res) {
        const { filename, csv } = await this.reports.exportLeadsCsv(actor, query || {});
        res?.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return csv;
    }

    // -------------------------------------------------------------------------
    // OPERATIONAL AGENT LEADERBOARD
    // -------------------------------------------------------------------------

    async getLeaderboard(actor, query) {
        return this.reports.getLeaderboard(actor, query || {});
    }

    async exportLeaderboard(actor, query, res) {
        const { filename, csv } = await this.reports.exportLeaderboardCsv(actor, query || {});
        res?.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return csv;
    }
};

__decorate([
    Get('calls'),
    RequirePermission(PERMISSIONS.callRead),
    __param(0, CurrentEmployee()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getCalls", null);

__decorate([
    Get('calls/export'),
    RequirePermission(PERMISSIONS.callRead),
    __param(0, CurrentEmployee()),
    __param(1, Query()),
    __param(2, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "exportCalls", null);

__decorate([
    Get('follow-ups'),
    RequirePermission(PERMISSIONS.callRead),
    __param(0, CurrentEmployee()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getFollowUps", null);

__decorate([
    Get('follow-ups/export'),
    RequirePermission(PERMISSIONS.callRead),
    __param(0, CurrentEmployee()),
    __param(1, Query()),
    __param(2, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "exportFollowUps", null);

__decorate([
    Get('customers'),
    RequirePermission(PERMISSIONS.customerRead),
    __param(0, CurrentEmployee()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getCustomers", null);

__decorate([
    Get('customers/export'),
    RequirePermission(PERMISSIONS.customerRead),
    __param(0, CurrentEmployee()),
    __param(1, Query()),
    __param(2, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "exportCustomers", null);

__decorate([
    Get('leads'),
    RequirePermission(PERMISSIONS.leadRead),
    __param(0, CurrentEmployee()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getLeads", null);

__decorate([
    Get('leads/export'),
    RequirePermission(PERMISSIONS.leadRead),
    __param(0, CurrentEmployee()),
    __param(1, Query()),
    __param(2, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "exportLeads", null);

__decorate([
    Get('leaderboard'),
    RequirePermission(PERMISSIONS.callRead),
    __param(0, CurrentEmployee()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getLeaderboard", null);

__decorate([
    Get('leaderboard/export'),
    RequirePermission(PERMISSIONS.callRead),
    __param(0, CurrentEmployee()),
    __param(1, Query()),
    __param(2, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "exportLeaderboard", null);

ReportsController = __decorate([
    Controller('reports'),
    __metadata("design:paramtypes", [typeof (_a = typeof ReportsService !== "undefined" && ReportsService) === "function" ? _a : Object])
], ReportsController);

export { ReportsController };
