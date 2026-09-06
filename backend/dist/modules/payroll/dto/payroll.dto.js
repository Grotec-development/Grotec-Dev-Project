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
exports.CreateAdvanceDto = exports.CreateSalaryRevisionDto = exports.ApprovePayrollDto = exports.GeneratePayrollDto = exports.CreatePayrollRunDto = void 0;
const class_validator_1 = require("class-validator");
class CreatePayrollRunDto {
    month;
    notes;
}
exports.CreatePayrollRunDto = CreatePayrollRunDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePayrollRunDto.prototype, "month", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePayrollRunDto.prototype, "notes", void 0);
class GeneratePayrollDto {
    month;
    notes;
}
exports.GeneratePayrollDto = GeneratePayrollDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GeneratePayrollDto.prototype, "month", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GeneratePayrollDto.prototype, "notes", void 0);
class ApprovePayrollDto {
    acknowledgeFlags;
}
exports.ApprovePayrollDto = ApprovePayrollDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], ApprovePayrollDto.prototype, "acknowledgeFlags", void 0);
class CreateSalaryRevisionDto {
    employeeId;
    effectiveFrom;
    baseSalary;
    components;
    notes;
}
exports.CreateSalaryRevisionDto = CreateSalaryRevisionDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateSalaryRevisionDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSalaryRevisionDto.prototype, "effectiveFrom", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateSalaryRevisionDto.prototype, "baseSalary", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateSalaryRevisionDto.prototype, "components", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSalaryRevisionDto.prototype, "notes", void 0);
class CreateAdvanceDto {
    employeeId;
    amount;
    reason;
    linkedMonth;
}
exports.CreateAdvanceDto = CreateAdvanceDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateAdvanceDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateAdvanceDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAdvanceDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAdvanceDto.prototype, "linkedMonth", void 0);
//# sourceMappingURL=payroll.dto.js.map