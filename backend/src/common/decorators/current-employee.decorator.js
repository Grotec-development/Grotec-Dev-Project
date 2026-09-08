import { createParamDecorator } from '@nestjs/common';
/** Injects the authenticated principal (from AuthGuard) into a handler. */
export const CurrentEmployee = createParamDecorator((_data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.employee;
});
