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
exports.RecordOutcomeDto = void 0;
const class_validator_1 = require("class-validator");
const shared_1 = require("@grotec/shared");
class RecordOutcomeDto {
    outcome;
    nextAction;
    followUpDate;
    followUpTime;
    followUpNote;
}
exports.RecordOutcomeDto = RecordOutcomeDto;
__decorate([
    (0, class_validator_1.IsIn)([...shared_1.CALL_OUTCOMES]),
    __metadata("design:type", String)
], RecordOutcomeDto.prototype, "outcome", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['CALLBACK', 'SALES']),
    __metadata("design:type", String)
], RecordOutcomeDto.prototype, "nextAction", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'followUpDate must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], RecordOutcomeDto.prototype, "followUpDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'followUpTime must be HH:mm' }),
    __metadata("design:type", String)
], RecordOutcomeDto.prototype, "followUpTime", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], RecordOutcomeDto.prototype, "followUpNote", void 0);
//# sourceMappingURL=record-outcome.dto.js.map