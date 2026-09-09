import { describe, expect, it } from 'vitest';
import { ImportService } from './import.service';

describe('ImportService (Validation & Preview)', () => {
  const service = new ImportService(null); // No database needed for static unit tests

  describe('detectColumnMappings', () => {
    it('automatically infers common English and Tamil column synonyms', () => {
      const headers = ['Farmer Name', 'Mobile Number', 'Alt Phone', 'Village Name', 'Taluk', 'District', 'Soil Profile', 'Language'];
      const mapping = service.detectColumnMappings(headers);

      expect(mapping.fullName).toBe('Farmer Name');
      expect(mapping.phone).toBe('Mobile Number');
      expect(mapping.secondaryPhone).toBe('Alt Phone');
      expect(mapping.village).toBe('Village Name');
      expect(mapping.taluk).toBe('Taluk');
      expect(mapping.district).toBe('District');
      expect(mapping.soilType).toBe('Soil Profile');
      expect(mapping.preferredLanguage).toBe('Language');
    });
  });

  describe('parseFile', () => {
    it('rejects binary Excel (.xlsx/.xls) uploads with guidance', () => {
      const buffer = Buffer.from('fake binary xlsx content');
      expect(() => service.parseFile(buffer, 'farmers.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))
        .toThrow(/Binary Excel \(\.xlsx\/\.xls\) files require the xlsx parser package/);
    });

    it('rejects unsupported file formats', () => {
      const buffer = Buffer.from('PDF content');
      expect(() => service.parseFile(buffer, 'farmers.pdf', 'application/pdf'))
        .toThrow(/Only CSV \(\.csv\) files are supported/);
    });

    it('rejects empty files', () => {
      expect(() => service.parseFile(Buffer.alloc(0), 'empty.csv', 'text/csv'))
        .toThrow(/uploaded file is empty/);
    });

    it('rejects header-only files with no data rows', () => {
      const headerOnly = Buffer.from('Name,Phone,District\n');
      expect(() => service.parseFile(headerOnly, 'nodata.csv', 'text/csv'))
        .toThrow(/contains headers but no data rows/);
    });

    it('successfully parses valid CSV buffer into rows with suggested mappings', () => {
      const csv = Buffer.from('Full Name,Phone,Soil Type\nRamesh,9876543001,Red loam\nSuresh,9876543002,Clay\n');
      const result = service.parseFile(csv, 'test.csv', 'text/csv');

      expect(result.rowCount).toBe(2);
      expect(result.headers).toEqual(['Full Name', 'Phone', 'Soil Type']);
      expect(result.suggestedMapping.fullName).toBe('Full Name');
      expect(result.suggestedMapping.phone).toBe('Phone');
      expect(result.suggestedMapping.soilType).toBe('Soil Type');
    });
  });

  describe('preview (Validation, Duplicate Detection, Deterministic Counts)', () => {
    it('validates required fields, formats, duplicates, and counts deterministically without writing to DB', async () => {
      const rows = [
        // Row 1: Valid row
        { name: 'Karthik Raja', mobile: '9876543101', soil: 'Red loam', dist: 'Dharmapuri' },
        // Row 2: Missing name (Invalid)
        { name: '', mobile: '9876543102', soil: 'Black soil', dist: 'Salem' },
        // Row 3: Invalid phone (Invalid)
        { name: 'Senthil Kumar', mobile: '123', soil: 'Sandy', dist: 'Trichy' },
        // Row 4: Soil type exceeds 40 chars (Invalid)
        { name: 'Murugan V.', mobile: '9876543103', soil: 'Extremely detailed excessive description of the farm soil that is way too long', dist: 'Erode' },
        // Row 5: Duplicate phone of Row 1 within the same file (Duplicate)
        { name: 'Karthik Raja Duplicate', mobile: '9876543101', soil: 'Red loam', dist: 'Dharmapuri' },
        // Row 6: Valid row with normalized +91 formatting
        { name: 'Anbarasan S.', mobile: '+919876543105', soil: 'Loam', dist: 'Namakkal' },
      ];

      const mapping = {
        fullName: 'name',
        phone: 'mobile',
        soilType: 'soil',
        district: 'dist',
      };

      const preview = await service.preview(rows, mapping, { id: 'test-admin', roleCode: 'FOUNDER' });

      expect(preview.totalRows).toBe(6);
      expect(preview.validRows).toBe(2); // Row 1, Row 6
      expect(preview.invalidRows).toBe(3); // Row 2 (no name), Row 3 (bad phone), Row 4 (oversized soil)
      expect(preview.duplicateRows).toBe(1); // Row 5 (duplicate of Row 1)

      // Row 1: Valid
      expect(preview.items[0].status).toBe('VALID');
      expect(preview.items[0].errors).toHaveLength(0);
      expect(preview.items[0].mapped.phone).toBe('+919876543101');

      // Row 2: Missing name
      expect(preview.items[1].status).toBe('INVALID');
      expect(preview.items[1].errors).toContain('Full Name is required');

      // Row 3: Invalid phone
      expect(preview.items[2].status).toBe('INVALID');
      expect(preview.items[2].errors.some((e) => e.includes('Invalid phone format'))).toBe(true);

      // Row 4: Oversized soilType
      expect(preview.items[3].status).toBe('INVALID');
      expect(preview.items[3].errors.some((e) => e.includes('exceeds maximum limit of 40 characters'))).toBe(true);

      // Row 5: Duplicate within file
      expect(preview.items[4].status).toBe('DUPLICATE');
      expect(preview.items[4].duplicateReason).toContain('Duplicate phone number within this import file (first seen at row 1)');

      // Row 6: Valid
      expect(preview.items[5].status).toBe('VALID');
      expect(preview.items[5].errors).toHaveLength(0);
    });

    it('rejects preview if required mappings are missing', async () => {
      const rows = [{ name: 'Test', phone: '9876543210' }];
      await expect(service.preview(rows, { phone: 'phone' })).rejects.toThrow(/Column mapping for Full Name is required/);
      await expect(service.preview(rows, { fullName: 'name' })).rejects.toThrow(/Column mapping for Phone is required/);
    });
  });
});
