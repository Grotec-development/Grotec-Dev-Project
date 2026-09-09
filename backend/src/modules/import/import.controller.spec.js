import { describe, expect, it } from 'vitest';
import { ImportController } from './import.controller';

describe('ImportController (Role & Permission Scoping)', () => {
  const controller = new ImportController({});

  it('allows FOUNDER to access import', () => {
    expect(() => controller.assertManagementRole({ roleCode: 'FOUNDER', permissions: [] })).not.toThrow();
  });

  it('allows MANAGER to access import', () => {
    expect(() => controller.assertManagementRole({ roleCode: 'MANAGER', permissions: [] })).not.toThrow();
  });

  it('allows user with explicit customer.import permission', () => {
    expect(() => controller.assertManagementRole({ roleCode: 'CUSTOM', permissions: ['customer.import'] })).not.toThrow();
  });

  it('blocks AGENT from accessing bulk import', () => {
    expect(() => controller.assertManagementRole({ roleCode: 'AGENT', permissions: ['customer.create'] }))
      .toThrow(/Customer bulk import is restricted to Management and Administrative personnel/);
  });

  it('blocks STAFF from accessing bulk import', () => {
    expect(() => controller.assertManagementRole({ roleCode: 'STAFF', permissions: [] }))
      .toThrow(/Customer bulk import is restricted to Management and Administrative personnel/);
  });

  it('blocks DELIVERY from accessing bulk import', () => {
    expect(() => controller.assertManagementRole({ roleCode: 'DELIVERY', permissions: [] }))
      .toThrow(/Customer bulk import is restricted to Management and Administrative personnel/);
  });
});
