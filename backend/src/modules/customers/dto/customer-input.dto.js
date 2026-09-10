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
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested, } from 'class-validator';
import { PhoneKind } from '@grotec/shared';
export class PhoneInputDto {
}
__decorate([
    IsString(),
    MaxLength(30),
    __metadata("design:type", String)
], PhoneInputDto.prototype, "number", void 0);
__decorate([
    IsOptional(),
    IsEnum(PhoneKind),
    __metadata("design:type", typeof (_a = typeof PhoneKind !== "undefined" && PhoneKind) === "function" ? _a : Object)
], PhoneInputDto.prototype, "kind", void 0);
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], PhoneInputDto.prototype, "isPrimary", void 0);
export class LocationInputDto {
}
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(300),
    __metadata("design:type", String)
], LocationInputDto.prototype, "addressLine", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(100),
    __metadata("design:type", String)
], LocationInputDto.prototype, "state", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(100),
    __metadata("design:type", String)
], LocationInputDto.prototype, "district", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(100),
    __metadata("design:type", String)
], LocationInputDto.prototype, "taluk", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(150),
    __metadata("design:type", String)
], LocationInputDto.prototype, "village", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(10),
    __metadata("design:type", String)
], LocationInputDto.prototype, "pincode", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsLatitude(),
    __metadata("design:type", Number)
], LocationInputDto.prototype, "latitude", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsLongitude(),
    __metadata("design:type", Number)
], LocationInputDto.prototype, "longitude", void 0);
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], LocationInputDto.prototype, "isPrimary", void 0);
export class CropInputDto {
}
__decorate([
    IsUUID(),
    __metadata("design:type", String)
], CropInputDto.prototype, "cropId", void 0);
__decorate([
    Type(() => Number),
    IsNumber({ maxDecimalPlaces: 2 }),
    Min(0.01),
    __metadata("design:type", Number)
], CropInputDto.prototype, "acreage", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(20),
    __metadata("design:type", String)
], CropInputDto.prototype, "unit", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(500),
    __metadata("design:type", String)
], CropInputDto.prototype, "notes", void 0);
export class PhoneListInputDto {
}
__decorate([
    IsArray(),
    ArrayMinSize(1),
    ArrayMaxSize(5),
    ValidateNested({ each: true }),
    Type(() => PhoneInputDto),
    __metadata("design:type", Array)
], PhoneListInputDto.prototype, "phones", void 0);
export class LocationListInputDto {
}
__decorate([
    IsArray(),
    ArrayMaxSize(5),
    ValidateNested({ each: true }),
    Type(() => LocationInputDto),
    __metadata("design:type", Array)
], LocationListInputDto.prototype, "locations", void 0);
export class CropListInputDto {
}
__decorate([
    IsArray(),
    ArrayMaxSize(20),
    ValidateNested({ each: true }),
    Type(() => CropInputDto),
    __metadata("design:type", Array)
], CropListInputDto.prototype, "crops", void 0);
