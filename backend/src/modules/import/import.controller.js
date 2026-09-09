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
var _a, _b, _c;
import {
  Body,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PERMISSIONS } from '@grotec/shared';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ApiError } from '../../common/errors/api-error';
import { ImportService } from './import.service';
import { ParseImportDto, PreviewImportDto } from './dto/import.dto';

/**
 * Controller for CSV / Customer data import.
 *
 * Implements parsing, column detection, field mapping, and preview validation.
 * Guarded by customer.create and scoped to Management (FOUNDER / MANAGER).
 * Does NOT persist records.
 */
let ImportController = class ImportController {
  constructor(importService) {
    this.importService = importService;
  }

  assertManagementRole(actor) {
    const isManagerOrAdmin = actor.roleCode === 'FOUNDER' || actor.roleCode === 'MANAGER';
    const hasExplicitImport = actor.permissions?.includes('customer.import');
    if (!isManagerOrAdmin && !hasExplicitImport) {
      throw ApiError.forbidden(
        'IMPORT_NOT_PERMITTED',
        'Customer bulk import is restricted to Management and Administrative personnel'
      );
    }
  }

  /**
   * Parses uploaded CSV file or inline CSV text and returns detected headers,
   * suggested mappings, and sample rows.
   */
  async parse(actor, file, body) {
    this.assertManagementRole(actor);

    if (file) {
      return this.importService.parseFile(file.buffer, file.originalname, file.mimetype);
    }

    if (body?.csvContent) {
      const buffer = Buffer.from(body.csvContent, 'utf8');
      return this.importService.parseFile(buffer, body.fileName || 'pasted_data.csv', 'text/csv');
    }

    throw ApiError.badRequest('NO_FILE_PROVIDED', 'Please provide a CSV file upload or csvContent text');
  }

  /**
   * Evaluates mapped rows, performing validations and duplicate detection.
   * Returns summary counts and row-level breakdown without saving.
   */
  async preview(actor, dto) {
    this.assertManagementRole(actor);
    return this.importService.preview(dto.rows, dto.mapping, actor);
  }
};

__decorate([
  Post('parse'),
  HttpCode(200),
  RequirePermission(PERMISSIONS.customerCreate),
  UseInterceptors(FileInterceptor('file')),
  __param(0, CurrentEmployee()),
  __param(1, UploadedFile()),
  __param(2, Body()),
  __metadata("design:type", Function),
  __metadata("design:paramtypes", [Object, Object, typeof (_b = typeof ParseImportDto !== "undefined" && ParseImportDto) === "function" ? _b : Object]),
  __metadata("design:returntype", Promise)
], ImportController.prototype, "parse", null);

__decorate([
  Post('preview'),
  HttpCode(200),
  RequirePermission(PERMISSIONS.customerCreate),
  __param(0, CurrentEmployee()),
  __param(1, Body()),
  __metadata("design:type", Function),
  __metadata("design:paramtypes", [Object, typeof (_c = typeof PreviewImportDto !== "undefined" && PreviewImportDto) === "function" ? _c : Object]),
  __metadata("design:returntype", Promise)
], ImportController.prototype, "preview", null);

ImportController = __decorate([
  Controller('import'),
  __metadata("design:paramtypes", [typeof (_a = typeof ImportService !== "undefined" && ImportService) === "function" ? _a : Object])
], ImportController);

export { ImportController };
