import { describe, expect, it } from 'vitest';
import { PERMISSIONS, PROPOSED_ROLE_PERMISSIONS } from './permissions';

/**
 * Guards the role -> permission matrix that both the API's PermissionGuard and
 * the web app's permission-aware navigation read from. These assertions pin the
 * decisions that are easy to undo by accident during an unrelated edit.
 */
describe('PROPOSED_ROLE_PERMISSIONS — relationship access', () => {
  it('grants AGENT read access to the relationship-manager portfolio', () => {
    expect(PROPOSED_ROLE_PERMISSIONS.AGENT).toContain(PERMISSIONS.relationshipRead);
  });

  it('does not grant AGENT relationship management (assign / release)', () => {
    expect(PROPOSED_ROLE_PERMISSIONS.AGENT).not.toContain(PERMISSIONS.relationshipManage);
  });

  it('keeps FOUNDER on both relationship read and manage', () => {
    expect(PROPOSED_ROLE_PERMISSIONS.FOUNDER).toContain(PERMISSIONS.relationshipRead);
    expect(PROPOSED_ROLE_PERMISSIONS.FOUNDER).toContain(PERMISSIONS.relationshipManage);
  });

  it('keeps MANAGER on both relationship read and manage', () => {
    expect(PROPOSED_ROLE_PERMISSIONS.MANAGER).toContain(PERMISSIONS.relationshipRead);
    expect(PROPOSED_ROLE_PERMISSIONS.MANAGER).toContain(PERMISSIONS.relationshipManage);
  });

  it('leaves STAFF without any relationship access', () => {
    expect(PROPOSED_ROLE_PERMISSIONS.STAFF).not.toContain(PERMISSIONS.relationshipRead);
    expect(PROPOSED_ROLE_PERMISSIONS.STAFF).not.toContain(PERMISSIONS.relationshipManage);
  });

  it('leaves DELIVERY without any relationship access', () => {
    expect(PROPOSED_ROLE_PERMISSIONS.DELIVERY).not.toContain(PERMISSIONS.relationshipRead);
    expect(PROPOSED_ROLE_PERMISSIONS.DELIVERY).not.toContain(PERMISSIONS.relationshipManage);
  });

  it('authorizes the /relationship-manager nav entry for AGENT', () => {
    // Shell.tsx gates that entry on `permission: 'relationship.read'`, so the
    // navigation becomes visible exactly when the role holds this code.
    const navPermission = 'relationship.read';
    expect(PERMISSIONS.relationshipRead).toBe(navPermission);
    expect(PROPOSED_ROLE_PERMISSIONS.AGENT).toContain(navPermission);
  });
});

describe('PROPOSED_ROLE_PERMISSIONS — unrelated role scopes hold', () => {
  it('still withholds audit and employee administration from AGENT', () => {
    expect(PROPOSED_ROLE_PERMISSIONS.AGENT).not.toContain(PERMISSIONS.auditRead);
    expect(PROPOSED_ROLE_PERMISSIONS.AGENT).not.toContain(PERMISSIONS.employeeRead);
  });

  it('keeps every role code mapped to a non-empty permission list', () => {
    for (const [role, codes] of Object.entries(PROPOSED_ROLE_PERMISSIONS)) {
      expect(Array.isArray(codes), `${role} must map to an array`).toBe(true);
      expect(codes.length, `${role} must hold at least one permission`).toBeGreaterThan(0);
    }
  });
});
