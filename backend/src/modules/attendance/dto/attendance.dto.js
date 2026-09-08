var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a, _b, _c;
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID, ValidateNested, } from 'class-validator';
import { AttendanceStatus } from '@grotec/shared';
export class MarkAttendanceDto {
}
__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], MarkAttendanceDto.prototype, "employeeId", void 0);
__decorate([
    IsString(),
    __metadata("design:type", String)
], MarkAttendanceDto.prototype, "date", void 0);
__decorate([
    IsEnum(AttendanceStatus),
    __metadata("design:type", typeof (_a = typeof AttendanceStatus !== "undefined" && AttendanceStatus) === "function" ? _a : Object)
], MarkAttendanceDto.prototype, "status", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], MarkAttendanceDto.prototype, "punchIn", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], MarkAttendanceDto.prototype, "punchOut", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], MarkAttendanceDto.prototype, "notes", void 0);
export class BulkAttendanceItemDto {
}
__decorate([
    IsUUID(),
    __metadata("design:type", String)
], BulkAttendanceItemDto.prototype, "employeeId", void 0);
__decorate([
    IsEnum(AttendanceStatus),
    __metadata("design:type", typeof (_b = typeof AttendanceStatus !== "undefined" && AttendanceStatus) === "function" ? _b : Object)
], BulkAttendanceItemDto.prototype, "status", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], BulkAttendanceItemDto.prototype, "punchIn", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], BulkAttendanceItemDto.prototype, "punchOut", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], BulkAttendanceItemDto.prototype, "notes", void 0);
export class BulkAttendanceDto {
}
__decorate([
    IsString(),
    __metadata("design:type", String)
], BulkAttendanceDto.prototype, "date", void 0);
__decorate([
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => BulkAttendanceItemDto),
    __metadata("design:type", Array)
], BulkAttendanceDto.prototype, "records", void 0);
export class RejectAttendanceDto {
}
__decorate([
    IsString(),
    __metadata("design:type", String)
], RejectAttendanceDto.prototype, "reason", void 0);
export class EsslPunchDto {
}
__decorate([
    IsString(),
    __metadata("design:type", String)
], EsslPunchDto.prototype, "deviceCode", void 0);
__decorate([
    IsString(),
    __metadata("design:type", String)
], EsslPunchDto.prototype, "biometricPin", void 0);
__decorate([
    IsString(),
    __metadata("design:type", String)
], EsslPunchDto.prototype, "punchTime", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EsslPunchDto.prototype, "punchType", void 0);
export class SyncEsslDto {
}
__decorate([
    IsOptional(),
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => EsslPunchDto),
    __metadata("design:type", Array)
], SyncEsslDto.prototype, "punches", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], SyncEsslDto.prototype, "date", void 0);
export class CreateEsslDeviceDto {
}
__decorate([
    IsString(),
    __metadata("design:type", String)
], CreateEsslDeviceDto.prototype, "deviceCode", void 0);
__decorate([
    IsString(),
    __metadata("design:type", String)
], CreateEsslDeviceDto.prototype, "name", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], CreateEsslDeviceDto.prototype, "ipAddress", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], CreateEsslDeviceDto.prototype, "location", void 0);
export class CreateEsslMappingDto {
}
__decorate([
    IsUUID(),
    __metadata("design:type", String)
], CreateEsslMappingDto.prototype, "employeeId", void 0);
__decorate([
    IsUUID(),
    __metadata("design:type", String)
], CreateEsslMappingDto.prototype, "deviceId", void 0);
__decorate([
    IsString(),
    __metadata("design:type", String)
], CreateEsslMappingDto.prototype, "biometricPin", void 0);
export class CorrectAttendanceDto {
}
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], CorrectAttendanceDto.prototype, "punchIn", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], CorrectAttendanceDto.prototype, "punchOut", void 0);
__decorate([
    IsOptional(),
    IsEnum(AttendanceStatus),
    __metadata("design:type", typeof (_c = typeof AttendanceStatus !== "undefined" && AttendanceStatus) === "function" ? _c : Object)
], CorrectAttendanceDto.prototype, "status", void 0);
__decorate([
    IsString(),
    __metadata("design:type", String)
], CorrectAttendanceDto.prototype, "reason", void 0);
export class EsslWebhookPunchDto {
}
__decorate([
    IsString(),
    __metadata("design:type", String)
], EsslWebhookPunchDto.prototype, "externalBiometricId", void 0);
__decorate([
    IsString(),
    __metadata("design:type", String)
], EsslWebhookPunchDto.prototype, "punchAt", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EsslWebhookPunchDto.prototype, "punchType", void 0);
export class EsslWebhookDto {
}
__decorate([
    IsString(),
    __metadata("design:type", String)
], EsslWebhookDto.prototype, "deviceId", void 0);
__decorate([
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => EsslWebhookPunchDto),
    __metadata("design:type", Array)
], EsslWebhookDto.prototype, "punches", void 0);
