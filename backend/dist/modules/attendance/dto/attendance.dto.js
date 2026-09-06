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
exports.EsslWebhookDto = exports.EsslWebhookPunchDto = exports.CorrectAttendanceDto = exports.CreateEsslMappingDto = exports.CreateEsslDeviceDto = exports.SyncEsslDto = exports.EsslPunchDto = exports.RejectAttendanceDto = exports.BulkAttendanceDto = exports.BulkAttendanceItemDto = exports.MarkAttendanceDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const shared_1 = require("@grotec/shared");
class MarkAttendanceDto {
    employeeId;
    date;
    status;
    punchIn;
    punchOut;
    notes;
}
exports.MarkAttendanceDto = MarkAttendanceDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MarkAttendanceDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MarkAttendanceDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(shared_1.AttendanceStatus),
    __metadata("design:type", String)
], MarkAttendanceDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MarkAttendanceDto.prototype, "punchIn", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MarkAttendanceDto.prototype, "punchOut", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MarkAttendanceDto.prototype, "notes", void 0);
class BulkAttendanceItemDto {
    employeeId;
    status;
    punchIn;
    punchOut;
    notes;
}
exports.BulkAttendanceItemDto = BulkAttendanceItemDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], BulkAttendanceItemDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(shared_1.AttendanceStatus),
    __metadata("design:type", String)
], BulkAttendanceItemDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BulkAttendanceItemDto.prototype, "punchIn", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BulkAttendanceItemDto.prototype, "punchOut", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BulkAttendanceItemDto.prototype, "notes", void 0);
class BulkAttendanceDto {
    date;
    records;
}
exports.BulkAttendanceDto = BulkAttendanceDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BulkAttendanceDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BulkAttendanceItemDto),
    __metadata("design:type", Array)
], BulkAttendanceDto.prototype, "records", void 0);
class RejectAttendanceDto {
    reason;
}
exports.RejectAttendanceDto = RejectAttendanceDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RejectAttendanceDto.prototype, "reason", void 0);
class EsslPunchDto {
    deviceCode;
    biometricPin;
    punchTime;
    punchType;
}
exports.EsslPunchDto = EsslPunchDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EsslPunchDto.prototype, "deviceCode", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EsslPunchDto.prototype, "biometricPin", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EsslPunchDto.prototype, "punchTime", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EsslPunchDto.prototype, "punchType", void 0);
class SyncEsslDto {
    punches;
    date;
}
exports.SyncEsslDto = SyncEsslDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => EsslPunchDto),
    __metadata("design:type", Array)
], SyncEsslDto.prototype, "punches", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SyncEsslDto.prototype, "date", void 0);
class CreateEsslDeviceDto {
    deviceCode;
    name;
    ipAddress;
    location;
}
exports.CreateEsslDeviceDto = CreateEsslDeviceDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateEsslDeviceDto.prototype, "deviceCode", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateEsslDeviceDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateEsslDeviceDto.prototype, "ipAddress", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateEsslDeviceDto.prototype, "location", void 0);
class CreateEsslMappingDto {
    employeeId;
    deviceId;
    biometricPin;
}
exports.CreateEsslMappingDto = CreateEsslMappingDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateEsslMappingDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateEsslMappingDto.prototype, "deviceId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateEsslMappingDto.prototype, "biometricPin", void 0);
class CorrectAttendanceDto {
    punchIn;
    punchOut;
    status;
    reason;
}
exports.CorrectAttendanceDto = CorrectAttendanceDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CorrectAttendanceDto.prototype, "punchIn", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CorrectAttendanceDto.prototype, "punchOut", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(shared_1.AttendanceStatus),
    __metadata("design:type", String)
], CorrectAttendanceDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CorrectAttendanceDto.prototype, "reason", void 0);
class EsslWebhookPunchDto {
    externalBiometricId;
    punchAt;
    punchType;
}
exports.EsslWebhookPunchDto = EsslWebhookPunchDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EsslWebhookPunchDto.prototype, "externalBiometricId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EsslWebhookPunchDto.prototype, "punchAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EsslWebhookPunchDto.prototype, "punchType", void 0);
class EsslWebhookDto {
    deviceId;
    punches;
}
exports.EsslWebhookDto = EsslWebhookDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EsslWebhookDto.prototype, "deviceId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => EsslWebhookPunchDto),
    __metadata("design:type", Array)
], EsslWebhookDto.prototype, "punches", void 0);
//# sourceMappingURL=attendance.dto.js.map