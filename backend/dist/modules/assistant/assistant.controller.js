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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantController = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const current_employee_decorator_1 = require("../../common/decorators/current-employee.decorator");
const require_permission_decorator_1 = require("../../common/decorators/require-permission.decorator");
const assistant_service_1 = require("./assistant.service");
const guidance_service_1 = require("./guidance.service");
const chat_dto_1 = require("./dto/chat.dto");
const create_guidance_dto_1 = require("./dto/create-guidance.dto");
const update_guidance_dto_1 = require("./dto/update-guidance.dto");
let AssistantController = class AssistantController {
    assistant;
    guidance;
    constructor(assistant, guidance) {
        this.assistant = assistant;
        this.guidance = guidance;
    }
    async chat(actor, dto) {
        return this.assistant.chat(actor, dto);
    }
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
exports.AssistantController = AssistantController;
__decorate([
    (0, common_1.Post)('chat'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.assistantUse),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, chat_dto_1.ChatDto]),
    __metadata("design:returntype", Promise)
], AssistantController.prototype, "chat", null);
__decorate([
    (0, common_1.Get)('guidance'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.assistantUse),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('includeInactive')),
    __param(2, (0, common_1.Query)('cropId')),
    __param(3, (0, common_1.Query)('type')),
    __param(4, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AssistantController.prototype, "listGuidance", null);
__decorate([
    (0, common_1.Post)('guidance'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.assistantManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_guidance_dto_1.CreateGuidanceDto]),
    __metadata("design:returntype", Promise)
], AssistantController.prototype, "createGuidance", null);
__decorate([
    (0, common_1.Patch)('guidance/:id'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.assistantManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_guidance_dto_1.UpdateGuidanceDto]),
    __metadata("design:returntype", Promise)
], AssistantController.prototype, "updateGuidance", null);
exports.AssistantController = AssistantController = __decorate([
    (0, common_1.Controller)('assistant'),
    __metadata("design:paramtypes", [assistant_service_1.AssistantService,
        guidance_service_1.GuidanceService])
], AssistantController);
//# sourceMappingURL=assistant.controller.js.map