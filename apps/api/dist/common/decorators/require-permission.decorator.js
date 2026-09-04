"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequirePermission = exports.REQUIRED_PERMISSIONS_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
const RequirePermission = (...permissions) => (0, common_1.SetMetadata)(exports.REQUIRED_PERMISSIONS_KEY, permissions);
exports.RequirePermission = RequirePermission;
//# sourceMappingURL=require-permission.decorator.js.map