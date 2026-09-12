var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendEmailDto {
}
__decorate([
    IsEmail(),
    IsNotEmpty(),
    __metadata("design:type", String)
], SendEmailDto.prototype, "to", void 0);

__decorate([
    IsString(),
    IsNotEmpty(),
    MinLength(1),
    MaxLength(255),
    __metadata("design:type", String)
], SendEmailDto.prototype, "subject", void 0);

__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], SendEmailDto.prototype, "body", void 0);

__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], SendEmailDto.prototype, "html", void 0);
