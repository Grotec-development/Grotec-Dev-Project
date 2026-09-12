var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SendWhatsAppDto {
}
__decorate([
    IsString(),
    IsNotEmpty(),
    MinLength(5),
    MaxLength(20),
    __metadata("design:type", String)
], SendWhatsAppDto.prototype, "to", void 0);

__decorate([
    IsString(),
    IsNotEmpty(),
    MinLength(1),
    MaxLength(4096),
    __metadata("design:type", String)
], SendWhatsAppDto.prototype, "body", void 0);

__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], SendWhatsAppDto.prototype, "templateName", void 0);

__decorate([
    IsOptional(),
    __metadata("design:type", Object)
], SendWhatsAppDto.prototype, "templateParams", void 0);

__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], SendWhatsAppDto.prototype, "customerId", void 0);

__decorate([
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], SendWhatsAppDto.prototype, "callId", void 0);
