var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsIn, IsNumber, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Records call outcome with support for dynamic CallOutcomeMaster codes,
 * next action, follow-up scheduling, and commercial opportunity fields.
 */
export class RecordOutcomeDto {
}
__decorate([
    IsString(),
    MinLength(1),
    MaxLength(50),
    __metadata("design:type", String)
], RecordOutcomeDto.prototype, "outcome", void 0);

__decorate([
    IsOptional(),
    IsIn(['CALLBACK', 'SALES']),
    __metadata("design:type", Object)
], RecordOutcomeDto.prototype, "nextAction", void 0);

__decorate([
    IsOptional(),
    Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'followUpDate must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], RecordOutcomeDto.prototype, "followUpDate", void 0);

__decorate([
    IsOptional(),
    Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'followUpTime must be HH:mm' }),
    __metadata("design:type", String)
], RecordOutcomeDto.prototype, "followUpTime", void 0);

__decorate([
    IsOptional(),
    IsString(),
    MinLength(1),
    MaxLength(2000),
    __metadata("design:type", String)
], RecordOutcomeDto.prototype, "followUpNote", void 0);

__decorate([
    IsOptional(),
    IsString(),
    MaxLength(200),
    __metadata("design:type", String)
], RecordOutcomeDto.prototype, "productInterest", void 0);

__decorate([
    IsOptional(),
    IsString(),
    MaxLength(200),
    __metadata("design:type", String)
], RecordOutcomeDto.prototype, "cropInterest", void 0);

__decorate([
    IsOptional(),
    Type(() => Number),
    IsNumber(),
    __metadata("design:type", Number)
], RecordOutcomeDto.prototype, "expectedBookingAmount", void 0);

__decorate([
    IsOptional(),
    IsString(),
    MaxLength(40),
    __metadata("design:type", String)
], RecordOutcomeDto.prototype, "callMode", void 0);
