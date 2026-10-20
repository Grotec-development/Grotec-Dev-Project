var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
let PrismaService = class PrismaService extends PrismaClient {
    async onModuleInit() {
        let retries = 3;
        while (retries > 0) {
            try {
                await this.$connect();
                return;
            } catch (err) {
                retries--;
                if (retries === 0) {
                    console.warn(`[PrismaService] Database connection could not be established on boot: ${err.message}. Ensure DATABASE_URL in backend/.env is properly configured.`);
                } else {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
            }
        }
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
};
PrismaService = __decorate([
    Injectable()
], PrismaService);
export { PrismaService };
