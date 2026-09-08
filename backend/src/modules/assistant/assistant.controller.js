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
var _a, _b, _c, _d, _e;
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AssistantService } from './assistant.service';
import { GuidanceService } from './guidance.service';
import { ChatDto } from './dto/chat.dto';
import { CreateGuidanceDto } from './dto/create-guidance.dto';
import { UpdateGuidanceDto } from './dto/update-guidance.dto';
let AssistantController = class AssistantController {
    constructor(assistant, guidance) {
        this.assistant = assistant;
        this.guidance = guidance;
    }
    // --- Chat (assistant.use: Founder, Manager, Agent/telecaller) ---
    async chat(actor, dto) {
        return this.assistant.chat(actor, dto);
    }
    // --- Knowledge Base browse/search (assistant.use: everyone with the chat) ---
    async listGuidance(actor, includeInactive, cropId, problemType, q) {
        return this.guidance.list({ includeInactive: includeInactive === 'true', cropId, problemType, q }, actor);
    }
    async createGuidance(actor, dto) {
        return this.guidance.create(actor, dto);
    }
    async updateGuidance(actor, id, dto) {
        return this.guidance.update(actor, id, dto);
    }
};
__decorate([
    Post('chat'),
    RequirePermission(PERMISSIONS.assistantUse),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_c = typeof ChatDto !== "undefined" && ChatDto) === "function" ? _c : Object]),
    __metadata("design:returntype", Promise)
], AssistantController.prototype, "chat", null);
__decorate([
    Get('guidance'),
    RequirePermission(PERMISSIONS.assistantUse),
    __param(0, CurrentEmployee()),
    __param(1, Query('includeInactive')),
    __param(2, Query('cropId')),
    __param(3, Query('type')),
    __param(4, Query('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AssistantController.prototype, "listGuidance", null);
__decorate([
    Post('guidance'),
    RequirePermission(PERMISSIONS.assistantManage),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_d = typeof CreateGuidanceDto !== "undefined" && CreateGuidanceDto) === "function" ? _d : Object]),
    __metadata("design:returntype", Promise)
], AssistantController.prototype, "createGuidance", null);
__decorate([
    Patch('guidance/:id'),
    RequirePermission(PERMISSIONS.assistantManage),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_e = typeof UpdateGuidanceDto !== "undefined" && UpdateGuidanceDto) === "function" ? _e : Object]),
    __metadata("design:returntype", Promise)
], AssistantController.prototype, "updateGuidance", null);
AssistantController = __decorate([
    Controller('assistant'),
    __metadata("design:paramtypes", [typeof (_a = typeof AssistantService !== "undefined" && AssistantService) === "function" ? _a : Object, typeof (_b = typeof GuidanceService !== "undefined" && GuidanceService) === "function" ? _b : Object])
], AssistantController);
export { AssistantController };
