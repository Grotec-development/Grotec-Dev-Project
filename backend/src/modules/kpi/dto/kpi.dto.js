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
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, } from 'class-validator';
import { KpiMetricType } from '@grotec/shared';
export class UpsertKpiTargetDto {
}
__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], UpsertKpiTargetDto.prototype, "employeeId", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], UpsertKpiTargetDto.prototype, "teamId", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], UpsertKpiTargetDto.prototype, "roleCode", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], UpsertKpiTargetDto.prototype, "team", void 0);
__decorate([
    IsString(),
    __metadata("design:type", String)
], UpsertKpiTargetDto.prototype, "period", void 0);
__decorate([
    IsEnum(KpiMetricType),
    __metadata("design:type", typeof (_a = typeof KpiMetricType !== "undefined" && KpiMetricType) === "function" ? _a : Object)
], UpsertKpiTargetDto.prototype, "metric", void 0);
__decorate([
    IsNumber(),
    __metadata("design:type", Number)
], UpsertKpiTargetDto.prototype, "targetValue", void 0);
__decorate([
    IsOptional(),
    IsNumber(),
    __metadata("design:type", Number)
], UpsertKpiTargetDto.prototype, "weight", void 0);
export class FreezeKpiScoreDto {
}
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], FreezeKpiScoreDto.prototype, "period", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], FreezeKpiScoreDto.prototype, "reviewNotes", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], FreezeKpiScoreDto.prototype, "coachingActions", void 0);
export class ComputeKpiDto {
}
__decorate([
    IsString(),
    __metadata("design:type", String)
], ComputeKpiDto.prototype, "period", void 0);
export class CreateKpiReviewEntryDto {
}
__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], CreateKpiReviewEntryDto.prototype, "periodScoreId", void 0);
__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], CreateKpiReviewEntryDto.prototype, "employeeId", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], CreateKpiReviewEntryDto.prototype, "period", void 0);
__decorate([
    IsString(),
    __metadata("design:type", String)
], CreateKpiReviewEntryDto.prototype, "body", void 0);
