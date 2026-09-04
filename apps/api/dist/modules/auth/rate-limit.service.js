"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let RateLimitService = class RateLimitService {
    buckets = new Map();
    maxAttempts;
    windowMs;
    constructor(config) {
        this.maxAttempts = Number(config.get('LOGIN_MAX_ATTEMPTS') ?? 5);
        this.windowMs = Number(config.get('LOGIN_WINDOW_MINUTES') ?? 15) * 60 * 1000;
    }
    key(email, ip) {
        return `${email.toLowerCase()}|${ip}`;
    }
    isLimited(email, ip) {
        const bucket = this.buckets.get(this.key(email, ip));
        if (!bucket)
            return false;
        if (Date.now() - bucket.windowStart >= this.windowMs) {
            this.buckets.delete(this.key(email, ip));
            return false;
        }
        return bucket.count >= this.maxAttempts;
    }
    recordFailure(email, ip) {
        const key = this.key(email, ip);
        const now = Date.now();
        const bucket = this.buckets.get(key);
        if (!bucket || now - bucket.windowStart >= this.windowMs) {
            this.buckets.set(key, { count: 1, windowStart: now });
        }
        else {
            bucket.count += 1;
        }
    }
    reset(email, ip) {
        this.buckets.delete(this.key(email, ip));
    }
};
exports.RateLimitService = RateLimitService;
exports.RateLimitService = RateLimitService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RateLimitService);
//# sourceMappingURL=rate-limit.service.js.map