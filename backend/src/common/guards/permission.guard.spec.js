import { describe, expect, it } from 'vitest';
import { PermissionGuard } from './permission.guard';

function contextFor(employee, required) {
  const reflector = { getAllAndOverride: () => required };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ employee }) }),
  };
  return { guard: new PermissionGuard(reflector), context };
}

describe('PermissionGuard', () => {
  it.each(['FOUNDER', 'SUPER_ADMIN', 'MANAGER'])('refuses %s when the permission is not granted', (roleCode) => {
    const { guard, context } = contextFor({ id: 'e1', roleCode, permissions: ['customer.read'] }, ['customer.delete']);
    expect(() => guard.canActivate(context)).toThrow(/Missing permission: customer\.delete/);
  });

  it('admits any role that holds every required permission', () => {
    const { guard, context } = contextFor({ id: 'e1', roleCode: 'FOUNDER', permissions: ['customer.delete'] }, ['customer.delete']);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('admits routes without a permission requirement', () => {
    const { guard, context } = contextFor({ id: 'e1', roleCode: 'AGENT', permissions: [] }, undefined);
    expect(guard.canActivate(context)).toBe(true);
  });
});
