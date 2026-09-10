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
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { EmployeeHistoryType } from '@grotec/shared';
export class CreateEmployeeHistoryDto {
}
__decorate([
    IsEnum(EmployeeHistoryType),
    __metadata("design:type", typeof (_a = typeof EmployeeHistoryType !== "undefined" && EmployeeHistoryType) === "function" ? _a : Object)
], CreateEmployeeHistoryDto.prototype, "type", void 0);
__decorate([
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], CreateEmployeeHistoryDto.prototype, "date", void 0);
__decorate([
    IsString(),
    IsNotEmpty(),
    MaxLength(500),
    __metadata("design:type", String)
], CreateEmployeeHistoryDto.prototype, "description", void 0);
__decorate([
    IsOptional(),
    __metadata("design:type", Object)
], CreateEmployeeHistoryDto.prototype, "metadata", void 0);
