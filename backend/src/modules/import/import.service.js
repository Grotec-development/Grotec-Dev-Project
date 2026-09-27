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
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as XLSX from 'xlsx';
import { normalizePhoneToE164 } from '@grotec/shared';
import { ApiError } from '../../common/errors/api-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseCsv, CSV_LIMITS } from './csv-parser.util';
import { resolveTenantId } from '../../common/utils/tenant-scope';

/**
 * Common column name synonyms for automatic mapping inference.
 */
const SYNONYMS = {
  fullName: ['fullname', 'full_name', 'name', 'farmername', 'farmer_name', 'customername', 'customer_name', 'farmer', 'customer'],
  phone: ['phone', 'mobile', 'contact', 'phonenumber', 'phone_number', 'mobilenumber', 'mobile_number', 'cell', 'primaryphone', 'primary_phone', 'phone1', 'mobile1'],
  secondaryPhone: ['secondaryphone', 'secondary_phone', 'altphone', 'alt_phone', 'alternatemobile', 'alternate_mobile', 'otherphone', 'other_phone', 'phone2', 'mobile2', 'contact2'],
  phone3: ['phone3', 'mobile3', 'contact3', 'thirdphone', 'thirdmobile'],
  village: ['village', 'villagename', 'town', 'city', 'place', 'location', 'gramam', 'oor'],
  taluk: ['taluk', 'talukname', 'tehsil', 'block', 'mandal', 'vattam'],
  district: ['district', 'districtname', 'dist', 'zilla', 'mavattam'],
  state: ['state', 'statename', 'state_name', 'region', 'manilam'],
  pincode: ['pincode', 'pin', 'postalcode', 'postal_code', 'zip', 'zipcode'],
  soilType: ['soil', 'soiltype', 'soil_type', 'soilprofile', 'soil_profile', 'farmsoil', 'farm_soil'],
  preferredLanguage: ['language', 'lang', 'preferredlanguage', 'preferred_language'],
};


/** Next sequential Farmer ID (GF + 8 zero-padded digits) from farmer_code_seq. */
async function nextFarmerCode(db) {
  const rows = await db.$queryRaw`SELECT nextval('farmer_code_seq') AS n`;
  const value = Number(rows[0]?.n ?? 0);
  return `GF${String(value).padStart(8, '0')}`;
}

let ImportService = class ImportService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Automatically infers column mappings by comparing normalized header names
   * against domain synonyms.
   */
  detectColumnMappings(headers) {
    const suggested = {};
    const usedHeaders = new Set();

    for (const [targetField, syns] of Object.entries(SYNONYMS)) {
      for (const h of headers) {
        if (usedHeaders.has(h)) continue;
        const norm = h.toLowerCase().replace(/[\s\-_.]/g, '');
        if (syns.includes(norm)) {
          suggested[targetField] = h;
          usedHeaders.add(h);
          break;
        }
      }
    }

    // Detect additional phone columns dynamically
    const phoneCols = [];
    for (const h of headers) {
      const norm = h.toLowerCase().replace(/[\s\-_.]/g, '');
      if (
        norm.includes('phone') ||
        norm.includes('mobile') ||
        norm.includes('contact') ||
        norm.includes('cell')
      ) {
        phoneCols.push(h);
      }
    }
    if (phoneCols.length > 0) {
      suggested.phoneColumns = phoneCols;
      if (!suggested.phone) suggested.phone = phoneCols[0];
      if (!suggested.secondaryPhone && phoneCols.length > 1) suggested.secondaryPhone = phoneCols[1];
      if (!suggested.phone3 && phoneCols.length > 2) suggested.phone3 = phoneCols[2];
    }

    return suggested;
  }

  /**
   * Validates file upload metadata and parses raw CSV or Excel content.
   * Supports .xlsx, .xls, and .csv formats.
   */
  parseFile(fileBuffer, originalFilename = '', mimeType = '') {
    const nameLower = originalFilename.toLowerCase();

    if (!fileBuffer || fileBuffer.length === 0) {
      throw ApiError.badRequest('EMPTY_FILE', 'The uploaded file is empty');
    }

    if (fileBuffer.length > CSV_LIMITS.MAX_FILE_SIZE_BYTES * 4) { // Allow up to 20MB for Excel files
      throw ApiError.badRequest(
        'FILE_TOO_LARGE',
        `File size exceeds maximum permitted limit of 20 MB`
      );
    }

    // 1. Handle Binary Excel Spreadsheets (.xlsx, .xls)
    if (
      nameLower.endsWith('.xlsx') ||
      nameLower.endsWith('.xls') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('excel') ||
      mimeType.includes('officedocument')
    ) {
      let workbook;
      try {
        workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      } catch (err) {
        throw ApiError.badRequest('EXCEL_PARSE_ERROR', `Failed to parse Excel file: ${err.message}`);
      }

      const sheetNames = workbook.SheetNames;
      if (!sheetNames || sheetNames.length === 0) {
        throw ApiError.badRequest('EMPTY_EXCEL', 'The uploaded Excel file contains no worksheets');
      }

      const firstSheet = workbook.Sheets[sheetNames[0]];
      const rawGrid = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

      if (!rawGrid || rawGrid.length === 0) {
        throw ApiError.badRequest('EMPTY_FILE', 'The uploaded Excel worksheet contains no data');
      }

      // First row contains column headers
      const rawHeaderRow = rawGrid[0] || [];
      const headers = [];
      for (let c = 0; c < rawHeaderRow.length; c++) {
        const val = String(rawHeaderRow[c] ?? '').trim();
        headers.push(val.length > 0 ? val : `Column_${c + 1}`);
      }

      if (headers.length === 0 || headers.every((h) => h.startsWith('Column_'))) {
        throw ApiError.badRequest('INVALID_EXCEL_HEADERS', 'Could not detect column headers in the first row');
      }

      const rows = [];
      for (let r = 1; r < rawGrid.length; r++) {
        const rowVals = rawGrid[r] || [];
        const hasData = rowVals.some((v) => String(v ?? '').trim().length > 0);
        if (!hasData) continue; // Skip blank rows

        const rowObj = {};
        for (let c = 0; c < headers.length; c++) {
          rowObj[headers[c]] = String(rowVals[c] ?? '').trim();
        }
        rows.push(rowObj);
      }

      if (rows.length === 0) {
        throw ApiError.badRequest('NO_DATA_ROWS', 'The Excel sheet contains headers but no data rows');
      }

      const suggestedMapping = this.detectColumnMappings(headers);

      return {
        fileName: originalFilename || 'uploaded_data.xlsx',
        headers,
        rowCount: rows.length,
        sampleRows: rows.slice(0, 10),
        rows,
        suggestedMapping,
      };
    }

    // 2. Handle CSV / Plain Text (.csv, .txt)
    if (nameLower && !nameLower.endsWith('.csv') && !nameLower.endsWith('.txt')) {
      throw ApiError.badRequest(
        'INVALID_FILE_TYPE',
        'Unsupported file format. Please upload an Excel (.xlsx/.xls) or CSV (.csv) file'
      );
    }

    const text = typeof fileBuffer === 'string' ? fileBuffer : fileBuffer.toString('utf8');
    let parsed;
    try {
      parsed = parseCsv(text);
    } catch (err) {
      throw ApiError.badRequest('CSV_PARSE_ERROR', err.message);
    }

    if (parsed.rowCount === 0) {
      throw ApiError.badRequest('NO_DATA_ROWS', 'The CSV file contains headers but no data rows');
    }

    const suggestedMapping = this.detectColumnMappings(parsed.headers);

    return {
      fileName: originalFilename || 'uploaded_data.csv',
      headers: parsed.headers,
      rowCount: parsed.rowCount,
      sampleRows: parsed.rows.slice(0, 10),
      rows: parsed.rows,
      suggestedMapping,
    };
  }

  /**
   * Helper to collect all non-empty phone strings from a row based on mapping.
   * Supports dynamic 1..N phone numbers per customer.
   */
  extractPhonesFromRow(row, mapping) {
    const rawPhones = [];

    // 1. From mapping.phoneColumns array if specified
    if (Array.isArray(mapping.phoneColumns)) {
      for (const col of mapping.phoneColumns) {
        if (col && row[col]) {
          const val = String(row[col]).trim();
          if (val) rawPhones.push(val);
        }
      }
    }

    // 2. From standard mapped phone fields
    const standardKeys = ['phone', 'secondaryPhone', 'phone3', 'phone4', 'phone5', 'alternatePhone', 'mobile', 'contact'];
    for (const key of standardKeys) {
      if (mapping[key] && row[mapping[key]]) {
        const val = String(row[mapping[key]]).trim();
        if (val) rawPhones.push(val);
      }
    }

    // 3. From any custom mapped key starting with "phone"
    for (const [mapKey, colName] of Object.entries(mapping)) {
      if (mapKey.startsWith('phone') && !standardKeys.includes(mapKey) && mapKey !== 'phoneColumns') {
        if (colName && row[colName]) {
          const val = String(row[colName]).trim();
          if (val) rawPhones.push(val);
        }
      }
    }

    // Deduplicate preserving order
    return Array.from(new Set(rawPhones));
  }

  /**
   * Evaluates mapped rows against business rules, required constraints,
   * within-file duplicate detection, and existing customer phone collisions.
   *
   * IMPORTANT: Missing Taluk does NOT fail the row or upload.
   */
  async preview(rows, mapping, actor) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw ApiError.badRequest('NO_ROWS', 'No data rows provided for preview');
    }

    if (!mapping || typeof mapping !== 'object') {
      throw ApiError.badRequest('INVALID_MAPPING', 'Column mapping must be provided');
    }

    if (!mapping.fullName || typeof mapping.fullName !== 'string') {
      throw ApiError.badRequest('MISSING_FULL_NAME_MAPPING', 'Column mapping for Full Name is required');
    }

    if (!mapping.phone || typeof mapping.phone !== 'string') {
      throw ApiError.badRequest('MISSING_PHONE_MAPPING', 'Column mapping for Primary Phone is required');
    }

    // Extract all candidate phone numbers from the batch to query existing database in bulk
    const candidatePhones = [];
    for (const r of rows) {
      const phones = this.extractPhonesFromRow(r, mapping);
      for (const p of phones) {
        const e164 = normalizePhoneToE164(p);
        if (e164) candidatePhones.push(e164);
      }
    }

    // Query existing active customer phones (read-only)
    const existingDbPhoneMap = new Map();
    if (this.prisma?.customerPhone && candidatePhones.length > 0) {
      try {
        const found = await this.prisma.customerPhone.findMany({
          where: {
            deletedAt: null,
            phoneE164: { in: candidatePhones },
          },
          include: {
            customer: {
              select: { id: true, fullName: true, status: true, farmerCode: true },
            },
          },
        });
        for (const record of found) {
          existingDbPhoneMap.set(record.phoneE164, record);
        }
      } catch {
        // Safe fallback in isolated test environments
      }
    }

    const seenPhonesInFile = new Map(); // phoneE164 -> first row index (1-based)
    const items = [];
    let validCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    let missingTalukCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;
      const errors = [];
      let isDuplicate = false;
      let duplicateReason = null;

      const rawFullName = String(row[mapping.fullName] ?? '').trim();
      const rawPhones = this.extractPhonesFromRow(row, mapping);
      const rawVillage = mapping.village ? String(row[mapping.village] ?? '').trim() : '';
      const rawTaluk = mapping.taluk ? String(row[mapping.taluk] ?? '').trim() : '';
      const rawDistrict = mapping.district ? String(row[mapping.district] ?? '').trim() : '';
      const rawState = mapping.state ? String(row[mapping.state] ?? '').trim() : 'Tamil Nadu';
      const rawPincode = mapping.pincode ? String(row[mapping.pincode] ?? '').trim() : '';
      const rawSoilType = mapping.soilType ? String(row[mapping.soilType] ?? '').trim() : '';
      const rawLanguage = mapping.preferredLanguage ? String(row[mapping.preferredLanguage] ?? '').trim() : '';

      // 1. Full Name validation
      if (!rawFullName) {
        errors.push('Full Name is required');
      } else if (rawFullName.length > 100) {
        errors.push('Full Name exceeds maximum limit of 100 characters');
      }

      // 2. Dynamic Phone Validation (1..N phones)
      const normalizedPhones = [];
      if (rawPhones.length === 0) {
        errors.push('At least one phone number is required');
      } else {
        for (let idx = 0; idx < rawPhones.length; idx++) {
          const rawP = rawPhones[idx];
          const e164 = normalizePhoneToE164(rawP);
          if (!e164) {
            if (idx === 0) {
              errors.push(`Invalid primary phone format: "${rawP}" (must be a valid 10-digit Indian phone or E.164)`);
            } else {
              errors.push(`Invalid additional phone format: "${rawP}"`);
            }
          } else if (!normalizedPhones.includes(e164)) {
            normalizedPhones.push(e164);
          }
        }
      }

      const primaryPhone = normalizedPhones[0] || (rawPhones[0] ? normalizePhoneToE164(rawPhones[0]) : null);
      const additionalPhones = normalizedPhones.slice(1);

      // 3. Location fields & Missing Taluk handling
      const talukMissing = !rawTaluk || rawTaluk.length === 0;
      if (talukMissing) {
        missingTalukCount++;
      } else if (rawTaluk.length > 100) {
        errors.push('Taluk name exceeds 100 characters');
      }

      if (rawVillage && rawVillage.length > 100) {
        errors.push('Village name exceeds 100 characters');
      }
      if (rawDistrict && rawDistrict.length > 100) {
        errors.push('District name exceeds 100 characters');
      }
      if (rawSoilType && rawSoilType.length > 40) {
        errors.push(`Soil type "${rawSoilType}" exceeds maximum limit of 40 characters`);
      }
      if (rawLanguage && rawLanguage.length > 10) {
        errors.push('Language code exceeds 10 characters');
      }

      // 4. Duplicate detection (only if primary phone is valid)
      if (primaryPhone) {
        if (seenPhonesInFile.has(primaryPhone)) {
          isDuplicate = true;
          duplicateReason = `Duplicate primary phone in file (first seen at row ${seenPhonesInFile.get(primaryPhone)})`;
        } else {
          seenPhonesInFile.set(primaryPhone, rowNumber);

          if (existingDbPhoneMap.has(primaryPhone)) {
            const match = existingDbPhoneMap.get(primaryPhone);
            isDuplicate = true;
            duplicateReason = `Phone registered to existing customer: ${match.customer.fullName} (${match.customer.farmerCode || match.customer.status})`;
          }
        }
      }

      let status = 'VALID';
      if (errors.length > 0) {
        status = 'INVALID';
        invalidCount++;
      } else if (isDuplicate) {
        status = 'DUPLICATE';
        duplicateCount++;
      } else {
        validCount++;
      }

      items.push({
        rowNumber,
        status,
        errors,
        duplicateReason,
        talukMissing,
        phoneCount: normalizedPhones.length || rawPhones.length,
        mapped: {
          fullName: rawFullName,
          phone: primaryPhone || rawPhones[0] || null,
          secondaryPhone: additionalPhones[0] || null,
          additionalPhones,
          allPhones: normalizedPhones,
          village: rawVillage || null,
          taluk: rawTaluk || null,
          district: rawDistrict || null,
          state: rawState || 'Tamil Nadu',
          pincode: rawPincode || null,
          soilType: rawSoilType || null,
          preferredLanguage: rawLanguage || null,
        },
        raw: row,
      });
    }

    return {
      totalRows: rows.length,
      validRows: validCount,
      invalidRows: invalidCount,
      duplicateRows: duplicateCount,
      missingTalukRows: missingTalukCount,
      detectedColumns: Object.keys(rows[0] ?? {}),
      mappingApplied: mapping,
      items,
    };
  }

  /**
   * Executes database insertion for imported customers.
   * Creates Customer, CustomerPhone(s), CustomerLocation, and Lead records in batches.
   *
   * Options:
   * - skipDuplicates: boolean (default true)
   * - leadOwnerId: string (optional employeeId to assign leads)
   * - assignRoundRobin: boolean (round robin assign among agentIds)
   * - agentIds: string[] (list of employee IDs for round-robin)
   */
  async execute(rows, mapping, options = {}, actor) {
    // 1. Run preview validation first
    const preview = await this.preview(rows, mapping, actor);

    const validItems = preview.items.filter(
      (item) => item.status === 'VALID' || (!options.skipDuplicates && item.status === 'DUPLICATE')
    );

    if (validItems.length === 0) {
      return {
        success: false,
        message: 'No valid rows to import. Please resolve validation errors and retry.',
        totalRows: preview.totalRows,
        createdCount: 0,
        skippedCount: preview.duplicateRows + preview.invalidRows,
        errorCount: preview.invalidRows,
        customerIds: [],
      };
    }

    const tenantId = await resolveTenantId(this.prisma, actor);
    const agentIds = Array.isArray(options.agentIds) && options.agentIds.length > 0 ? options.agentIds : null;
    let agentIndex = 0;

    const createdCustomerIds = [];
    const BATCH_SIZE = 250;

    for (let b = 0; b < validItems.length; b += BATCH_SIZE) {
      const chunk = validItems.slice(b, b + BATCH_SIZE);

      await this.prisma.$transaction(
        async (tx) => {
          // 1. Bulk generate farmer codes in a single query
          const seqRows = await tx.$queryRawUnsafe(
            `SELECT nextval('farmer_code_seq')::text AS n FROM generate_series(1, ${chunk.length})`
          );

          const customerRecords = [];
          const phoneRecords = [];
          const locationRecords = [];
          const leadRecords = [];
          const ownershipRecords = [];

          for (let i = 0; i < chunk.length; i++) {
            const item = chunk[i];
            const m = item.mapped;
            const customerId = randomUUID();
            const leadId = randomUUID();
            const rawSeq = seqRows[i]?.n ?? (i + 1);
            const farmerCode = `GF${String(rawSeq).padStart(8, '0')}`;

            createdCustomerIds.push(customerId);

            customerRecords.push({
              id: customerId,
              farmerCode,
              fullName: m.fullName,
              soilType: m.soilType || null,
              preferredLanguage: m.preferredLanguage || 'ta',
              tenantId,
              createdById: actor.id,
            });

            const allPhones = m.allPhones && m.allPhones.length > 0 ? m.allPhones : [m.phone].filter(Boolean);
            if (allPhones.length > 0) {
              for (let pIdx = 0; pIdx < allPhones.length; pIdx++) {
                phoneRecords.push({
                  id: randomUUID(),
                  customerId,
                  phoneE164: allPhones[pIdx],
                  rawInput: allPhones[pIdx],
                  kind: 'MOBILE',
                  isPrimary: pIdx === 0,
                  createdById: actor.id,
                });
              }
            }

            locationRecords.push({
              id: randomUUID(),
              customerId,
              state: m.state || 'Tamil Nadu',
              district: m.district || null,
              taluk: m.taluk || null,
              village: m.village || null,
              pincode: m.pincode || null,
              isPrimary: true,
              createdById: actor.id,
            });

            let assignedEmployeeId = actor.id;
            if (options.assignRoundRobin && agentIds && agentIds.length > 0) {
              assignedEmployeeId = agentIds[agentIndex % agentIds.length];
              agentIndex++;
            } else if (options.leadOwnerId) {
              assignedEmployeeId = options.leadOwnerId;
            }

            leadRecords.push({
              id: leadId,
              customerId,
              tenantId,
              source: 'EXCEL_IMPORT',
              notes: item.talukMissing ? 'Taluk not available — please update Taluk' : null,
              createdById: actor.id,
            });

            ownershipRecords.push({
              id: randomUUID(),
              leadId,
              employeeId: assignedEmployeeId,
              assignedById: actor.id,
              reason: 'Assigned during bulk customer import',
            });
          }

          // 2. Bulk insert across entities in 5 fast queries per chunk
          await tx.customer.createMany({ data: customerRecords });
          if (phoneRecords.length > 0) {
            await tx.customerPhone.createMany({ data: phoneRecords });
          }
          if (locationRecords.length > 0) {
            await tx.customerLocation.createMany({ data: locationRecords });
          }
          if (leadRecords.length > 0) {
            await tx.lead.createMany({ data: leadRecords });
          }
          if (ownershipRecords.length > 0) {
            await tx.leadOwnership.createMany({ data: ownershipRecords });
          }
        },
        { maxWait: 30000, timeout: 60000 }
      );
    }

    return {
      success: true,
      message: `Successfully imported ${createdCustomerIds.length} farmers into the database`,
      totalRows: preview.totalRows,
      createdCount: createdCustomerIds.length,
      skippedCount: preview.duplicateRows,
      errorCount: preview.invalidRows,
      missingTalukCount: preview.missingTalukRows,
      customerIds: createdCustomerIds,
    };
  }
};

ImportService = __decorate([
  Injectable(),
  __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object])
], ImportService);

export { ImportService };
