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
var _a, _b, _c, _d;
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AddNoteDto } from './dto/add-note.dto';
import { PlaceCallDto } from './dto/place-call.dto';
import { RecordOutcomeDto } from './dto/record-outcome.dto';
import { CallsService } from './calls.service';
let CallsController = class CallsController {
    constructor(calls) {
        this.calls = calls;
    }
    place(actor, dto) {
        return this.calls.placeCall(actor, dto);
    }
    queue(actor, ownerId) {
        return this.calls.queue(actor, { ownerId });
    }
    active(actor) {
        return this.calls.getActiveCall(actor);
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
__decorate([
    Post(),
    RequirePermission(PERMISSIONS.callManage),
    __param(0, CurrentEmployee()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_b = typeof PlaceCallDto !== "undefined" && PlaceCallDto) === "function" ? _b : Object]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "place", null);
__decorate([
    Get('queue'),
    RequirePermission(PERMISSIONS.callRead),
    __param(0, CurrentEmployee()),
    __param(1, Query('ownerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "queue", null);
__decorate([
    Get('active'),
    RequirePermission(PERMISSIONS.callRead),
    __param(0, CurrentEmployee()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "active", null);
__decorate([
    Get(':id/context'),
    RequirePermission(PERMISSIONS.callRead),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "context", null);
__decorate([
    Get(':id'),
    RequirePermission(PERMISSIONS.callRead),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "detail", null);
__decorate([
    Post(':id/end'),
    RequirePermission(PERMISSIONS.callManage),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "end", null);
__decorate([
    Post(':id/notes'),
    RequirePermission(PERMISSIONS.callManage),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_c = typeof AddNoteDto !== "undefined" && AddNoteDto) === "function" ? _c : Object]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "note", null);
__decorate([
    Post(':id/outcome'),
    RequirePermission(PERMISSIONS.callManage),
    __param(0, CurrentEmployee()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, typeof (_d = typeof RecordOutcomeDto !== "undefined" && RecordOutcomeDto) === "function" ? _d : Object]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "outcome", null);
CallsController = __decorate([
    Controller('calls'),
    __metadata("design:paramtypes", [typeof (_a = typeof CallsService !== "undefined" && CallsService) === "function" ? _a : Object])
], CallsController);
export { CallsController };
