import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateEmployeeDto } from './create-employee.dto.js';

describe('CreateEmployeeDto - Name Validation (BUG-016)', () => {
  const validBase = {
    email: 'test@grotec.local',
    roleId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    password: 'Password123',
  };

  it('accepts valid person names including regional scripts and hyphens', async () => {
    const validNames = [
      'Ramesh Patel',
      "O'Neil",
      'Anne-Marie',
      'Dr. Swaminathan',
      'முருகன்',
      'राजेश कुमार',
    ];

    for (const fullName of validNames) {
      const dto = plainToInstance(CreateEmployeeDto, { ...validBase, fullName });
      const errors = await validate(dto);
      const nameErrors = errors.filter((e) => e.property === 'fullName');
      expect(nameErrors.length, `Expected "${fullName}" to be valid`).toBe(0);
    }
  });

  it('rejects script injections, formulas, and malformed strings', async () => {
    const badNames = [
      '<script>',
      '<script>alert("xss")</script>',
      '@@##',
      '12345',
      '=cmd',
      '+sum(A1)',
      "-1234",
      '@admin',
      "Ravi'; DROP TABLE--",
    ];

    for (const fullName of badNames) {
      const dto = plainToInstance(CreateEmployeeDto, { ...validBase, fullName });
      const errors = await validate(dto);
      const nameErrors = errors.filter((e) => e.property === 'fullName');
      expect(nameErrors.length, `Expected "${fullName}" to be rejected`).toBeGreaterThan(0);
    }
  });
});
