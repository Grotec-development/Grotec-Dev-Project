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
import { IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { CropListInputDto, LocationListInputDto, PhoneListInputDto, } from './customer-input.dto';
export class CreateCustomerDto {
}
__decorate([
    IsString(),
    MinLength(2),
    MaxLength(200),
    __metadata("design:type", String)
], CreateCustomerDto.prototype, "fullName", void 0);
__decorate([
    ValidateNested(),
    Type(() => PhoneListInputDto),
    __metadata("design:type", typeof (_a = typeof PhoneListInputDto !== "undefined" && PhoneListInputDto) === "function" ? _a : Object)
], CreateCustomerDto.prototype, "phones", void 0);
__decorate([
    ValidateNested(),
    Type(() => LocationListInputDto),
    __metadata("design:type", typeof (_b = typeof LocationListInputDto !== "undefined" && LocationListInputDto) === "function" ? _b : Object)
], CreateCustomerDto.prototype, "locations", void 0);
__decorate([
    ValidateNested(),
    Type(() => CropListInputDto),
    __metadata("design:type", typeof (_c = typeof CropListInputDto !== "undefined" && CropListInputDto) === "function" ? _c : Object)
], CreateCustomerDto.prototype, "crops", void 0);
