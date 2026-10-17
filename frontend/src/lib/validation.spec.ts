import { describe, expect, it } from 'vitest';
import { validatePersonName, validatePassword } from './validation';

describe('validatePersonName', () => {
  it('accepts standard and international names', () => {
    expect(validatePersonName('Ramesh Patel').valid).toBe(true);
    expect(validatePersonName("O'Neil").valid).toBe(true);
    expect(validatePersonName('Anne-Marie').valid).toBe(true);
    expect(validatePersonName('Dr. K. Swaminathan').valid).toBe(true);
    // Regional Tamil name
    expect(validatePersonName('முருகன்').valid).toBe(true);
    // Regional Hindi name
    expect(validatePersonName('राजेश कुमार').valid).toBe(true);
  });

  it('rejects script injections and dangerous characters', () => {
    expect(validatePersonName('<script>alert(1)</script>').valid).toBe(false);
    expect(validatePersonName("Ravi'; DROP TABLE employees;--").valid).toBe(false);
    expect(validatePersonName('@@##$$').valid).toBe(false);
    expect(validatePersonName('123456').valid).toBe(false);
  });

  it('rejects spreadsheet formula triggers', () => {
    expect(validatePersonName('=cmd|').valid).toBe(false);
    expect(validatePersonName('+SUM(A1:A10)').valid).toBe(false);
    expect(validatePersonName('-12345').valid).toBe(false);
    expect(validatePersonName('@special').valid).toBe(false);
  });

  it('rejects too short or too long names', () => {
    expect(validatePersonName('A').valid).toBe(false);
    expect(validatePersonName('A'.repeat(61)).valid).toBe(false);
    expect(validatePersonName('').valid).toBe(false);
  });
});

describe('validatePassword', () => {
  it('accepts strong passwords', () => {
    expect(validatePassword('Grotec@2026').valid).toBe(true);
    expect(validatePassword('Strong#P4ssword').valid).toBe(true);
  });

  it('rejects weak passwords', () => {
    expect(validatePassword('short1!').valid).toBe(false);
    expect(validatePassword('nocapitals123!').valid).toBe(false);
    expect(validatePassword('NOLOWERCASE123!').valid).toBe(false);
    expect(validatePassword('NoSpecialNumber123').valid).toBe(false);
    expect(validatePassword('NoNumbersHere!').valid).toBe(false);
  });
});
