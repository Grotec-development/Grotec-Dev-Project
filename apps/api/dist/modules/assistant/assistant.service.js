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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantService = exports.ASSISTANT_UNAVAILABLE = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@grotec/shared");
const audit_service_1 = require("../../common/audit/audit.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const llm_provider_1 = require("./llm/llm-provider");
exports.ASSISTANT_UNAVAILABLE = 'The assistant is temporarily unavailable (no AI provider is configured in this environment). Please try again later, or ask the relationship manager.';
const STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'what', 'which', 'should', 'would', 'how', 'why', 'when', 'where',
    'recommend', 'recommended', 'suggest', 'suggestion', 'please', 'need', 'help', 'tell', 'advise',
    'about', 'this', 'that', 'they', 'their', 'them', 'are', 'was', 'were', 'you', 'your', 'have',
    'has', 'had', 'there', 'some', 'any', 'from', 'crop', 'crops', 'farmer', 'farmers', 'i', 'my',
]);
const COMPANY_CONTEXT_SYSTEM_PROMPT = `You are "Grotec Assistant", the in-CRM advisor for Grotec Agro Products (grotecagro.com), an organic/bio agri-inputs manufacturer in Dharmapuri, Tamil Nadu, India, serving farmers since 2007 (products regulated under the Fertilizer Control Order, 1985).
Product lines: bio-fertilizers / bio-inoculants (Azos, Azotob, Rhizob, PHOS, Micromix, Bio Jeevan PF, Bio Jeevan TV); "Jeevan Sakthi" organic growth & protection (Ultra Action +, Trishul, Asthra, Sanjeevini Gel); plus Raksha, Thavam and Organic Fertilizer (enriched organic manure). All are 100% organic, biodegradable inputs that improve yield, soil structure/fertility, pest & disease resistance and stress tolerance.
You answer GROTEC telecallers mid-call about a farmer's crop problem. Use ONLY the guidance records supplied in <guidance>. If none are relevant, say so plainly and suggest checking with the relationship manager. Never invent products, dosages, or agronomic claims. Be concise (2-6 sentences), practical and farmer-friendly. Include the usage stage/method from the guidance when present, and always tell the caller to follow the product label.`;
function tokenize(message) {
    return message
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}
const MAX_SOURCES = 3;
let AssistantService = class AssistantService {
    prisma;
    audit;
    llm;
    logger = new common_1.Logger('AssistantService');
    constructor(prisma, audit, llm) {
        this.prisma = prisma;
        this.audit = audit;
        this.llm = llm;
    }
    async chat(actor, dto) {
        const conversationId = dto.conversationId ?? (0, node_crypto_1.randomUUID)();
        const tokens = tokenize(dto.message);
        const sources = await this.retrieve(tokens, dto.cropId);
        const customerContext = dto.customerId ? await this.customerContextLine(dto.customerId) : null;
        if (!this.llm.available) {
            await this.auditChat(actor, conversationId, dto.message, 'unavailable', []);
            return { status: 'unavailable', conversationId, answer: exports.ASSISTANT_UNAVAILABLE, sources: [] };
        }
        try {
            const guidanceBlock = JSON.stringify(sources.map((s) => ({
                crop: s.cropName,
                problemKeywords: s.problemKeywords,
                recommendedProducts: s.recommendedProducts,
                usageGuidance: s.usageGuidance,
            })));
            const userContent = [
                dto.message.trim(),
                customerContext ? `\n\n[Farmer context] ${customerContext}` : '',
                sources.length > 0 ? `\n\n<guidance>\n${guidanceBlock}\n</guidance>` : '\n\n<guidance>none found</guidance>',
            ].join('');
            const answer = await this.llm.complete([
                { role: 'system', content: COMPANY_CONTEXT_SYSTEM_PROMPT },
                { role: 'user', content: userContent },
            ]);
            await this.auditChat(actor, conversationId, dto.message, 'answered', sources.map((s) => s.id), answer);
            return { status: 'answered', conversationId, answer, sources };
        }
        catch (error) {
            this.logger.warn(`assistant chat failed: ${error instanceof Error ? error.message : String(error)}`);
            await this.auditChat(actor, conversationId, dto.message, 'unavailable', []);
            return { status: 'unavailable', conversationId, answer: exports.ASSISTANT_UNAVAILABLE, sources: [] };
        }
    }
    async retrieve(tokens, cropId) {
        const rows = await this.prisma.cropProductGuidance.findMany({
            where: { isActive: true },
            select: {
                id: true,
                cropId: true,
                crop: { select: { name: true, code: true } },
                problemKeywords: true,
                recommendedProducts: true,
                usageGuidance: true,
            },
        });
        if (rows.length === 0)
            return [];
        const scored = [];
        for (const row of rows) {
            let score = 0;
            if (cropId && row.cropId === cropId)
                score += 10;
            const haystack = [row.crop.name, row.crop.code, ...row.problemKeywords, ...row.recommendedProducts]
                .join(' ')
                .toLowerCase();
            for (const token of tokens) {
                if (haystack.includes(token)) {
                    score += row.crop.name.toLowerCase().includes(token) ? 2 : 1;
                }
            }
            if (score > 0)
                scored.push({ score, row });
        }
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, MAX_SOURCES).map(({ row }) => ({
            id: row.id,
            cropId: row.cropId,
            cropName: row.crop.name,
            problemKeywords: row.problemKeywords,
            recommendedProducts: row.recommendedProducts,
            usageGuidance: row.usageGuidance,
        }));
    }
    async customerContextLine(customerId) {
        const customer = await this.prisma.customer.findFirst({
            where: { id: customerId, deletedAt: null },
            select: {
                fullName: true,
                crops: { where: { deletedAt: null }, select: { crop: { select: { name: true } } } },
                locations: { where: { isPrimary: true, deletedAt: null }, take: 1, select: { village: true, district: true } },
            },
        });
        if (!customer)
            return null;
        const crops = customer.crops.map((c) => c.crop.name).join(', ') || 'not recorded';
        const place = customer.locations[0];
        const location = place ? [place.village, place.district].filter(Boolean).join(', ') : null;
        const parts = [`${customer.fullName} — crops: ${crops}`];
        if (location)
            parts.push(`location: ${location}`);
        return parts.join('; ');
    }
    async auditChat(actor, conversationId, question, status, sourceIds, answer) {
        await this.audit.recordDirect({
            actorId: actor.id,
            entityType: shared_1.AuditEntityType.ASSISTANT,
            entityId: conversationId,
            entityLabel: question.slice(0, 80),
            action: shared_1.AuditAction.ASSISTANT_CHAT,
            meta: {
                question,
                status,
                sourceIds,
                model: this.llm.available ? this.llm.model : undefined,
                answer: answer ?? undefined,
            },
        });
    }
};
exports.AssistantService = AssistantService;
exports.AssistantService = AssistantService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(llm_provider_1.ASSISTANT_LLM_PROVIDER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService, Object])
], AssistantService);
//# sourceMappingURL=assistant.service.js.map