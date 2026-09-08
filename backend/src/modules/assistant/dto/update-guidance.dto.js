var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PROBLEM_TYPES } from '@grotec/shared';
export class UpdateGuidanceDto {
}
__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], UpdateGuidanceDto.prototype, "cropId", void 0);
__decorate([
    IsOptional(),
    IsArray(),
    ArrayMinSize(1),
    ArrayMaxSize(10),
    IsString({ each: true }),
    MinLength(2, { each: true }),
    MaxLength(80, { each: true }),
    __metadata("design:type", Array)
], UpdateGuidanceDto.prototype, "problemKeywords", void 0);
__decorate([
    IsOptional(),
    IsArray(),
    ArrayMinSize(1),
    ArrayMaxSize(10),
    IsString({ each: true }),
    MinLength(2, { each: true }),
    MaxLength(80, { each: true }),
    __metadata("design:type", Array)
], UpdateGuidanceDto.prototype, "recommendedProducts", void 0);
__decorate([
    IsOptional(),
    IsIn(PROBLEM_TYPES),
    __metadata("design:type", Object)
], UpdateGuidanceDto.prototype, "problemType", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(2000),
    __metadata("design:type", String)
], UpdateGuidanceDto.prototype, "usageGuidance", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(2000),
    __metadata("design:type", String)
], UpdateGuidanceDto.prototype, "notes", void 0);
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateGuidanceDto.prototype, "isActive", void 0);
