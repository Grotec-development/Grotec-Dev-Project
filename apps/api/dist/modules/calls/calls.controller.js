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
exports.CallsController = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@grotec/shared");
const current_employee_decorator_1 = require("../../common/decorators/current-employee.decorator");
const require_permission_decorator_1 = require("../../common/decorators/require-permission.decorator");
const add_note_dto_1 = require("./dto/add-note.dto");
const place_call_dto_1 = require("./dto/place-call.dto");
const record_outcome_dto_1 = require("./dto/record-outcome.dto");
const calls_service_1 = require("./calls.service");
let CallsController = class CallsController {
    calls;
    constructor(calls) {
        this.calls = calls;
    }
    place(actor, dto) {
        return this.calls.placeCall(actor, dto);
    }
    queue(actor, ownerId) {
        return this.calls.queue(actor, { ownerId });
    }
    context(actor, id) {
        return this.calls.callContext(id, actor);
    }
    detail(actor, id) {
        return this.calls.detailOrThrow(id, actor);
    }
    end(actor, id) {
        return this.calls.endCall(id, actor);
    }
    note(actor, id, dto) {
        return this.calls.addNote(id, actor, dto);
    }
    outcome(actor, id, dto) {
        return this.calls.recordOutcome(actor, id, dto);
    }
};
exports.CallsController = CallsController;
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.callManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, place_call_dto_1.PlaceCallDto]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "place", null);
__decorate([
    (0, common_1.Get)('queue'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.callRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Query)('ownerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "queue", null);
__decorate([
    (0, common_1.Get)(':id/context'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.callRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "context", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.callRead),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(':id/end'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.callManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "end", null);
__decorate([
    (0, common_1.Post)(':id/notes'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.callManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, add_note_dto_1.AddNoteDto]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "note", null);
__decorate([
    (0, common_1.Post)(':id/outcome'),
    (0, require_permission_decorator_1.RequirePermission)(shared_1.PERMISSIONS.callManage),
    __param(0, (0, current_employee_decorator_1.CurrentEmployee)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, record_outcome_dto_1.RecordOutcomeDto]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "outcome", null);
exports.CallsController = CallsController = __decorate([
    (0, common_1.Controller)('calls'),
    __metadata("design:paramtypes", [calls_service_1.CallsService])
], CallsController);
//# sourceMappingURL=calls.controller.js.map