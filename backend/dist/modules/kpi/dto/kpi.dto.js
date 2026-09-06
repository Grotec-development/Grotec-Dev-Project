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
exports.CreateKpiReviewEntryDto = exports.ComputeKpiDto = exports.FreezeKpiScoreDto = exports.UpsertKpiTargetDto = void 0;
const class_validator_1 = require("class-validator");
const shared_1 = require("@grotec/shared");
class UpsertKpiTargetDto {
    employeeId;
    teamId;
    roleCode;
    team;
    period;
    metric;
    targetValue;
    weight;
}
exports.UpsertKpiTargetDto = UpsertKpiTargetDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertKpiTargetDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertKpiTargetDto.prototype, "teamId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertKpiTargetDto.prototype, "roleCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertKpiTargetDto.prototype, "team", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertKpiTargetDto.prototype, "period", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(shared_1.KpiMetricType),
    __metadata("design:type", String)
], UpsertKpiTargetDto.prototype, "metric", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertKpiTargetDto.prototype, "targetValue", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertKpiTargetDto.prototype, "weight", void 0);
class FreezeKpiScoreDto {
    period;
    reviewNotes;
    coachingActions;
}
exports.FreezeKpiScoreDto = FreezeKpiScoreDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], FreezeKpiScoreDto.prototype, "period", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], FreezeKpiScoreDto.prototype, "reviewNotes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], FreezeKpiScoreDto.prototype, "coachingActions", void 0);
class ComputeKpiDto {
    period;
}
exports.ComputeKpiDto = ComputeKpiDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ComputeKpiDto.prototype, "period", void 0);
class CreateKpiReviewEntryDto {
    periodScoreId;
    employeeId;
    period;
    body;
}
exports.CreateKpiReviewEntryDto = CreateKpiReviewEntryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateKpiReviewEntryDto.prototype, "periodScoreId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateKpiReviewEntryDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateKpiReviewEntryDto.prototype, "period", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateKpiReviewEntryDto.prototype, "body", void 0);
//# sourceMappingURL=kpi.dto.js.map