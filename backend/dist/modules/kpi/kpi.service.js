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
exports.KpiService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const audit_service_1 = require("../../common/audit/audit.service");
const api_error_1 = require("../../common/errors/api-error");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let KpiService = class KpiService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async getTargets(actor, query) {
        const conditions = [];
        if (query.period)
            conditions.push({ period: query.period });
        if (query.teamId)
            conditions.push({ OR: [{ teamId: query.teamId }, { team: query.teamId }] });
        if (actor.roleCode === 'FOUNDER') {
            if (query.employeeId)
                conditions.push({ employeeId: query.employeeId });
            if (query.roleCode)
                conditions.push({ roleCode: query.roleCode });
        }
        else if (actor.roleCode === 'MANAGER') {
            if (query.employeeId) {
                if (query.employeeId !== actor.id) {
                    const target = await this.prisma.employee.findUnique({
                        where: { id: query.employeeId },
                        include: { role: true },
                    });
                    if (!target || !(0, shared_1.outranks)(actor.roleCode, target.role.code)) {
                        throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view KPI targets for roles strictly below your rank (PRD §5.1.2)');
                    }
                }
                conditions.push({ employeeId: query.employeeId });
            }
            else {
                conditions.push({
                    OR: [
                        { employeeId: actor.id },
                        { employee: { role: { code: { in: ['AGENT', 'DELIVERY', 'STAFF'] } } } },
                    ],
                });
            }
            if (query.roleCode)
                conditions.push({ roleCode: query.roleCode });
        }
        else {
            if (query.employeeId && query.employeeId !== actor.id) {
                throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view your own KPI targets (PRD §5.1.2)');
            }
            conditions.push({ employeeId: actor.id });
        }
        return this.prisma.kpiTarget.findMany({
            where: conditions.length > 0 ? { AND: conditions } : {},
            include: {
                employee: {
                    select: { id: true, fullName: true, employeeCode: true, department: true },
                },
            },
            orderBy: [{ period: 'desc' }, { metric: 'asc' }],
        });
    }
    async upsertTarget(actor, dto) {
        if (actor.roleCode !== 'FOUNDER' && actor.roleCode !== 'MANAGER') {
            throw api_error_1.ApiError.forbidden('FORBIDDEN', 'Only management can configure KPI targets');
        }
        const hasEmployee = Boolean(dto.employeeId);
        const hasTeam = Boolean(dto.teamId || dto.team);
        if ((hasEmployee && hasTeam) || (!hasEmployee && !hasTeam)) {
            throw api_error_1.ApiError.badRequest('EXACTLY_ONE_SCOPE_REQUIRED', 'Exactly one of employeeId or teamId must be provided');
        }
        if (dto.employeeId) {
            const target = await this.prisma.employee.findUnique({
                where: { id: dto.employeeId },
                include: { role: true },
            });
            if (!target)
                throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Target employee not found');
            if (actor.roleCode !== 'FOUNDER') {
                if (!(0, shared_1.outranks)(actor.roleCode, target.role.code)) {
                    throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only configure KPI targets for roles strictly below your rank (PRD §5.1.2)');
                }
            }
            const frozenScore = await this.prisma.kpiPeriodScore.findUnique({
                where: { employeeId_period: { employeeId: dto.employeeId, period: dto.period } },
            });
            if (frozenScore?.isFrozen) {
                throw api_error_1.ApiError.conflict('KPI_TARGET_LOCKED', 'KPI target is locked because the period score is already frozen');
            }
        }
        const target = await this.prisma.kpiTarget.create({
            data: {
                employeeId: dto.employeeId,
                teamId: dto.teamId ?? dto.team,
                roleCode: dto.roleCode,
                team: dto.team ?? dto.teamId,
                period: dto.period,
                metric: dto.metric,
                targetValue: dto.targetValue,
                weight: dto.weight ?? 1,
                createdById: actor.id,
            },
        });
        await this.audit.record(this.prisma, {
            actorId: actor.id,
            entityType: shared_1.AuditEntityType.EMPLOYEE,
            entityId: dto.employeeId ?? actor.id,
            entityLabel: `${dto.metric} target for ${dto.period}`,
            action: shared_1.AuditAction.KPI_TARGET_SET,
            after: target,
        });
        return target;
    }
    async getMyScore(actor, period) {
        return this.getScore(actor, actor.id, period);
    }
    async getScore(actor, employeeId, period) {
        const isSelf = employeeId === actor.id;
        const targetEmp = await this.prisma.employee.findUnique({
            where: { id: employeeId },
            include: { role: true },
        });
        if (!targetEmp)
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Target employee not found');
        if (!isSelf && actor.roleCode !== 'FOUNDER') {
            if (!(0, shared_1.outranks)(actor.roleCode, targetEmp.role.code)) {
                throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only view KPI scores for roles strictly below your rank (PRD §5.1.2)');
            }
        }
        const existing = await this.prisma.kpiPeriodScore.findUnique({
            where: { employeeId_period: { employeeId, period } },
            include: { employee: true, reviewEntries: true },
        });
        if (existing && existing.isFrozen) {
            return {
                ...existing,
                isFrozen: true,
                source: 'HISTORICAL_LOCKED',
            };
        }
        const [yearStr, monthStr] = period.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const startDate = new Date(Date.UTC(year, month - 1, 1));
        const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
        const targets = await this.prisma.kpiTarget.findMany({
            where: {
                period,
                OR: [{ employeeId }, { employeeId: null }],
            },
        });
        const calls = await this.prisma.call.findMany({
            where: {
                agentId: employeeId,
                startedAt: { gte: startDate, lte: endDate },
            },
        });
        const callsDialed = calls.length;
        const callsConnected = calls.filter((c) => c.status === 'CONNECTED' || c.status === 'ENDED').length;
        const leadsConverted = await this.prisma.relationshipOwnership.count({
            where: {
                assignedById: employeeId,
                reason: 'conversion_sales',
                assignedAt: { gte: startDate, lte: endDate },
            },
        });
        const conversionRate = callsDialed > 0 ? Number(((leadsConverted / callsDialed) * 100).toFixed(1)) : 0;
        const attendanceRecords = await this.prisma.attendanceRecord.findMany({
            where: { employeeId, date: { gte: startDate, lte: endDate } },
        });
        const presentCount = attendanceRecords.filter((r) => r.status === 'PRESENT' ||
            r.status === 'WEEKLY_OFF' ||
            r.status === 'HOLIDAY' ||
            r.status === 'LEAVE').length;
        const attendanceRate = attendanceRecords.length > 0
            ? Number(((presentCount / Math.max(1, attendanceRecords.length)) * 100).toFixed(1))
            : 100;
        const followUps = await this.prisma.followUp.findMany({
            where: { agentId: employeeId, dueAt: { gte: startDate, lte: endDate } },
        });
        const completedFollowUps = followUps.filter((f) => f.status === 'COMPLETED').length;
        const crmDiscipline = followUps.length > 0 ? Number(((completedFollowUps / followUps.length) * 100).toFixed(1)) : 100;
        const actualValues = {
            CRM_CALLS_DIALED: callsDialed,
            CRM_CALLS_CONNECTED: callsConnected,
            CRM_LEADS_CONVERTED: leadsConverted,
            CRM_CONVERSION_RATE: conversionRate,
            ATTENDANCE: attendanceRate,
            CRM_DISCIPLINE: crmDiscipline,
            TOTAL_REVENUE: null,
            revenueStatus: 'PENDING_SOURCE_PHASE_2',
        };
        const targetMap = {};
        const weightMap = {};
        const achievementMap = {};
        let totalWeight = 0;
        let weightedSum = 0;
        for (const t of targets) {
            const metric = t.metric;
            const targetVal = Number(t.targetValue);
            const weight = Number(t.weight);
            targetMap[metric] = targetVal;
            weightMap[metric] = weight;
            const actual = actualValues[metric];
            if (typeof actual === 'number' && targetVal > 0) {
                const ach = Number(Math.min(150, (actual / targetVal) * 100).toFixed(1));
                achievementMap[metric] = ach;
                totalWeight += weight;
                weightedSum += ach * weight;
            }
        }
        const overallScore = totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(1)) : 85.0;
        let performanceStatus = 'Meets Expectations';
        if (overallScore >= 95)
            performanceStatus = 'Exceeds Expectations';
        else if (overallScore < 65)
            performanceStatus = 'Unsatisfactory';
        else if (overallScore < 80)
            performanceStatus = 'Needs Improvement';
        return {
            employeeId,
            period,
            actualValues,
            targetValues: targetMap,
            weights: weightMap,
            achievementPercentages: achievementMap,
            overallScore,
            performanceStatus,
            reviewNotes: existing?.reviewNotes ?? null,
            coachingActions: existing?.coachingActions ?? null,
            isFrozen: false,
            source: 'LIVE_COMPUTED',
            reviewEntries: existing?.reviewEntries ?? [],
        };
    }
    async compute(actor, dto) {
        if (actor.roleCode !== 'FOUNDER' && actor.roleCode !== 'MANAGER') {
            throw api_error_1.ApiError.forbidden('FORBIDDEN', 'Only management can compute KPI scores');
        }
        const period = dto.period;
        const employees = await this.prisma.employee.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
            select: { id: true, fullName: true, role: true },
        });
        const results = [];
        for (const emp of employees) {
            const computed = await this.getScore(actor, emp.id, period);
            const periodScore = await this.prisma.kpiPeriodScore.upsert({
                where: { employeeId_period: { employeeId: emp.id, period } },
                create: {
                    employeeId: emp.id,
                    period,
                    actualValues: computed.actualValues,
                    targetValues: computed.targetValues,
                    weights: computed.weights,
                    achievementPercentages: computed.achievementPercentages,
                    overallScore: computed.overallScore,
                    performanceStatus: computed.performanceStatus,
                    reviewNotes: computed.reviewNotes,
                    coachingActions: computed.coachingActions,
                    isFrozen: false,
                },
                update: {
                    actualValues: computed.actualValues,
                    targetValues: computed.targetValues,
                    weights: computed.weights,
                    achievementPercentages: computed.achievementPercentages,
                    overallScore: computed.overallScore,
                    performanceStatus: computed.performanceStatus,
                },
            });
            results.push(periodScore);
        }
        await this.audit.record(this.prisma, {
            actorId: actor.id,
            entityType: shared_1.AuditEntityType.EMPLOYEE,
            entityId: actor.id,
            entityLabel: `Computed KPI scores for ${period} (${results.length} employees)`,
            action: shared_1.AuditAction.KPI_COMPUTED,
            after: { period, count: results.length },
        });
        return { period, computedCount: results.length, scores: results };
    }
    async addReviewEntry(actor, dto) {
        if (actor.roleCode !== 'FOUNDER' && actor.roleCode !== 'MANAGER') {
            throw api_error_1.ApiError.forbidden('FORBIDDEN', 'Only management can add review entries');
        }
        let scoreId = dto.periodScoreId;
        if (!scoreId && dto.employeeId && dto.period) {
            const score = await this.prisma.kpiPeriodScore.findUnique({
                where: { employeeId_period: { employeeId: dto.employeeId, period: dto.period } },
            });
            scoreId = score?.id;
        }
        if (!scoreId) {
            throw api_error_1.ApiError.notFound('KPI_SCORE_NOT_FOUND', 'Target KPI period score not found');
        }
        const periodScore = await this.prisma.kpiPeriodScore.findUnique({
            where: { id: scoreId },
        });
        if (!periodScore)
            throw api_error_1.ApiError.notFound('KPI_SCORE_NOT_FOUND', 'Target KPI period score not found');
        if (periodScore.isFrozen) {
            throw api_error_1.ApiError.conflict('KPI_SCORE_FROZEN', 'Cannot add review entries to a frozen period score');
        }
        return this.prisma.kpiReviewEntry.create({
            data: {
                kpiPeriodScoreId: scoreId,
                authorId: actor.id,
                body: dto.body,
            },
        });
    }
    async freezeScore(actor, employeeId, period, dto) {
        const targetEmp = await this.prisma.employee.findUnique({
            where: { id: employeeId },
            include: { role: true },
        });
        if (!targetEmp)
            throw api_error_1.ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Target employee not found');
        if (actor.id === employeeId) {
            throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You cannot freeze your own KPI score');
        }
        if (actor.roleCode !== 'FOUNDER') {
            if (!(0, shared_1.outranks)(actor.roleCode, targetEmp.role.code)) {
                throw api_error_1.ApiError.forbidden('ROLE_HIERARCHY_FORBIDDEN', 'You can only freeze KPI scores for roles strictly below your rank (PRD §5.1.2)');
            }
        }
        const liveScore = await this.getScore(actor, employeeId, period);
        const periodScore = await this.prisma.kpiPeriodScore.upsert({
            where: { employeeId_period: { employeeId, period } },
            create: {
                employeeId,
                period,
                actualValues: liveScore.actualValues,
                targetValues: liveScore.targetValues,
                weights: liveScore.weights,
                achievementPercentages: liveScore.achievementPercentages,
                overallScore: liveScore.overallScore,
                performanceStatus: liveScore.performanceStatus,
                reviewNotes: dto.reviewNotes ?? null,
                coachingActions: dto.coachingActions ?? null,
                isFrozen: true,
                frozenAt: new Date(),
            },
            update: {
                reviewNotes: dto.reviewNotes ?? undefined,
                coachingActions: dto.coachingActions ?? undefined,
                isFrozen: true,
                frozenAt: new Date(),
            },
            include: { reviewEntries: true },
        });
        await this.audit.record(this.prisma, {
            actorId: actor.id,
            entityType: shared_1.AuditEntityType.EMPLOYEE,
            entityId: employeeId,
            entityLabel: `KPI Score Frozen for ${targetEmp.fullName} (${period})`,
            action: shared_1.AuditAction.KPI_SCORE_FROZEN,
            after: periodScore,
        });
        return periodScore;
    }
    async getTeamSummary(actor, period) {
        const scores = await this.prisma.kpiPeriodScore.findMany({
            where: { period },
            include: {
                employee: {
                    select: { id: true, fullName: true, employeeCode: true, department: true, designation: true },
                },
            },
        });
        const totalEmployees = scores.length;
        const avgScore = totalEmployees > 0
            ? Number((scores.reduce((sum, s) => sum + Number(s.overallScore), 0) / totalEmployees).toFixed(1))
            : 0;
        return {
            period,
            totalEmployees,
            averageScore: avgScore,
            scores,
        };
    }
};
exports.KpiService = KpiService;
exports.KpiService = KpiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], KpiService);
//# sourceMappingURL=kpi.service.js.map