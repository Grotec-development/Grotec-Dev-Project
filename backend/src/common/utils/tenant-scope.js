import { DEFAULT_TENANT_SLUG } from '../../modules/tenant/tenant.service';

let defaultTenantId = null;

/**
 * Tenant that records written by `actor` belong to: the tenant on the actor's
 * token, else the default tenant (single-tenant deployments and legacy
 * accounts created before multi-tenancy). Null only if no tenant row exists.
 */
export async function resolveTenantId(prisma, actor) {
    if (actor?.tenantId)
        return actor.tenantId;
    if (!defaultTenantId) {
        defaultTenantId = prisma.tenant
            .findUnique({ where: { slug: DEFAULT_TENANT_SLUG }, select: { id: true } })
            .then((tenant) => tenant?.id ?? null)
            .catch((err) => {
                defaultTenantId = null; // retry on the next call
                throw err;
            });
    }
    return defaultTenantId;
}
