var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a;
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ProductsService } from './products.service';

let ProductsController = class ProductsController {
    constructor(products) {
        this.products = products;
    }

    async listCategories() {
        return this.products.listCategories();
    }

    async list(query) {
        return this.products.list(query);
    }

    async getById(id) {
        return this.products.getById(id);
    }

    async create(actor, body) {
        return this.products.create(actor, body);
    }

    async update(actor, id, body) {
        return this.products.update(actor, id, body);
    }
};

__decorate([
    Get('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "listCategories", null);

__decorate([
    Get(),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "list", null);

__decorate([
    Get(':id'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "getById", null);

__decorate([
    Post(),
    RequirePermission('production.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "create", null);

__decorate([
    Patch(':id'),
    RequirePermission('production.manage'),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "update", null);

ProductsController = __decorate([
    ApiTags('Products'),
    ApiBearerAuth(),
    Controller('products'),
    __metadata("design:paramtypes", [typeof (_a = typeof ProductsService !== "undefined" && ProductsService) === "function" ? _a : Object])
], ProductsController);

export { ProductsController };
