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
exports.CreateGuidanceDto = exports.PROBLEM_TYPES = void 0;
const class_validator_1 = require("class-validator");
exports.PROBLEM_TYPES = ['PEST', 'DISEASE', 'NUTRIENT_DEFICIENCY', 'WEED', 'OTHER'];
class CreateGuidanceDto {
    cropId;
    problemKeywords;
    recommendedProducts;
    problemType;
    usageGuidance;
    notes;
    isActive;
}
exports.CreateGuidanceDto = CreateGuidanceDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateGuidanceDto.prototype, "cropId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(10),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MinLength)(2, { each: true }),
    (0, class_validator_1.MaxLength)(80, { each: true }),
    __metadata("design:type", Array)
], CreateGuidanceDto.prototype, "problemKeywords", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(10),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MinLength)(2, { each: true }),
    (0, class_validator_1.MaxLength)(80, { each: true }),
    __metadata("design:type", Array)
], CreateGuidanceDto.prototype, "recommendedProducts", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PROBLEM_TYPES),
    __metadata("design:type", String)
], CreateGuidanceDto.prototype, "problemType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateGuidanceDto.prototype, "usageGuidance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateGuidanceDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateGuidanceDto.prototype, "isActive", void 0);
//# sourceMappingURL=create-guidance.dto.js.map