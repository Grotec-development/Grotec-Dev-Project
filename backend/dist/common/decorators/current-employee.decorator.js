"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentEmployee = void 0;
const common_1 = require("@nestjs/common");
exports.CurrentEmployee = (0, common_1.createParamDecorator)((_data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.employee;
});
//# sourceMappingURL=current-employee.decorator.js.map