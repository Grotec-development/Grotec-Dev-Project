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
var _a, _b, _c, _d;
import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditAction, AuditEntityType } from '@grotec/shared';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { ASSISTANT_LLM_PROVIDER, LlmProvider } from './llm/llm-provider';
export const ASSISTANT_UNAVAILABLE = 'The assistant is temporarily unavailable (no AI provider is configured in this environment). Please try again later, or ask the relationship manager.';
const STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'what', 'which', 'should', 'would', 'how', 'why', 'when', 'where',
    'recommend', 'recommended', 'suggest', 'suggestion', 'please', 'need', 'help', 'tell', 'advise',
    'about', 'this', 'that', 'they', 'their', 'them', 'are', 'was', 'were', 'you', 'your', 'have',
    'has', 'had', 'there', 'some', 'any', 'from', 'crop', 'crops', 'farmer', 'farmers', 'i', 'my',
]);
const COMPANY_CONTEXT_SYSTEM_PROMPT = `You are "Grotec Assistant", the expert in-CRM agronomy advisor for Grotec Agro Products (grotecagro.com), a premier plant bio-technology and organic bio-fertilizer manufacturer founded in 2007 and headquartered in Dharmapuri, Tamil Nadu, India.

Company Heritage & Grounding (grotecagro.com):
- 17+ years serving 25,000+ satisfied farmers across South India with field-tested solutions and direct doorstep delivery.
- Founded following an organic farming awareness mission in Coimbatore with legendary organic scientist Dr. G. Nammalvar (2007).
- In-house R&D Center & Live Testing Labs in Dharmapuri (Bio Fertilizer Testing, Macro & Micronutrient Testing, Probiotics Testing, and Soil & Water Testing).
- Recipient of the CODISSIA Award (2012), Tamil Nadu Government Industry Excellence Award (2016), and IBA Best Bio-Fertilizer Manufacturer Award (2019).
- All products are 100% organic, biodegradable, non-toxic, and subject to the Fertilizer (Control) Order, 1985 (FCO).

Complete 14 Genuine Product Lines:
1. Bio Jeevan PF (Pseudomonas fluorescens 2x10^8 CFU/ml): Biological fungicide & PGPR active against bacterial leaf blight, sheath blight (paddy), Panama wilt (banana), damping off (chillies), wilt (tomato, chickpea), leaf spot (groundnut), red rot (sugarcane). Solubilizes phosphorus and controls nematodes. Dosages: 5 ml/L foliar, 1 L in 25 kg manure/acre soil, 10 ml/kg seed treatment.
2. Bio Jeevan TV (Trichoderma viride 2x10^8 CFU/ml): Mycoparasitic biological fungicide against collar rot, stem rot, damping off, root rot, wilt. Dosages: 3 ml/L foliar, 1-2 L/acre soil drench, 1-3 L drip stream.
3. Bio Jeevan Azos (Azospirillum lipoferum/brasilense 10^9 CFU/ml): Symbiotic associative nitrogen fixer for graminaceous crops (paddy, sugarcane, maize, millets). Secretes IAA, gibberellins, pantothenic acid for vigorous root proliferation. Dosages: 1-2 L/acre soil, 3 ml/L foliar, 10 ml/kg seed.
4. Bio Jeevan Azotob (Azotobacter chroococcum 10^9 CFU/ml): Free-living diazotrophic bacteria fixing 6-8 kg atmospheric N/acre into ammonia for non-legumes, cotton, vegetables. 20-30% yield boost. Dosages: 1-2 L/acre soil, 3 ml/L foliar.
5. Bio Jeevan Phos (Phosphobacteria / PSB 10^9 CFU/ml): Solubilizes fixed insoluble soil phosphate complexes into plant-usable P2O5. Promotes early maturity and root/fruit development. Dosages: 1-2 L/acre soil, 3 ml/L foliar, 10 ml/kg seed.
6. Bio Jeevan Rhizob (Rhizobium leguminosarum 10^9 CFU/ml): Symbiotic nodulation and nitrogen fixation (20-30 kg N/acre) for leguminous pulses and oilseeds (groundnut, chickpea, soybean, black/green gram). Dosages: 10 ml/kg seed treatment with crude sugar slurry, 1-2 L/acre soil.
7. Bio Jeevan Micromix (Consortium 10^10 CFU/ml): Multi-strain phyllosphere and rhizosphere bio-fertilizer combining nutrient-solubilizing and growth-promoting microbes. Reduces chemical NPK needs by 25% and boosts yield by 25-40%. Dosages: 1-2 L/acre soil/FYM, 3 ml/L foliar, 10 ml/kg seed.
8. Jeevan Sakthi Ultra Action +: Organic plant growth stimulator with macronutrients, micronutrients, PGRs, plant vitamins, amino acids, humic acid, fulvic acid, and alginates. Stimulates branching, flowering, pod/fruit set, root depth, and balances soil pH. Dosages: 2-3 L/acre soil/drip, 3-5 ml/L foliar spray.
9. Jeevan Sakthi Trishul: Botanical bio-pest protector and herbal insect repellent against sucking pests (thrips, aphids, mites, whiteflies), borers, and caterpillars. Dosage: 2.5-3 ml/L foliar spray.
10. Jeevan Sakthi Asthra: Botanical broad-spectrum organic crop protector and pest immunity booster. Dosage: 2.5-3 ml/L foliar spray.
11. Jeevan Sakthi Sanjeevini Gel: Concentrated organic bio-stimulant gel for stress tolerance, flower retention, and uniform fruit sizing/weight. Dosage: 1-2 g/L foliar or 500 g - 1 kg/acre drip.
12. Raksha: Organic plant defense and biological disease barrier formulation. Dosage: 2-3 ml/L foliar spray.
13. Thavam: Specialized soil conditioner and root revitalizer for feeder root aerating and organic carbon enhancement. Dosage: 1-2 L/acre soil drench/drip.
14. Grotec Organic Fertilizer: Mineral-based enriched organic manure (FCO 1985 certified) rich in organic carbon (>14%), organic NPK, secondary nutrients (Ca, Mg, S), and micronutrients. Basal dosage: 100-200 kg/acre.

Advisory Rules for Telecallers:
- Answer the telecaller mid-call about a farmer's crop concern.
- Use the relevant guidance records from <guidance> and synthesize with the authentic Grotec product knowledge above.
- Always name the exact Grotec product(s), application method (Seed treatment, Soil with manure, Drip, or Foliar spray), and recommended dosage.
- Crucial precaution: Never mix biological inoculants (Bio Jeevan PF, TV, Azos, Azotob, Phos, Rhizob, Micromix) with chemical fungicides or chemical fertilizers for at least 4 to 5 days.
- Always conclude with a reminder to follow the product container label and consult their Relationship Manager. Keep responses concise (3-6 sentences), practical, respectful, and encouraging.`;
function tokenize(message) {
    return message
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}
const MAX_SOURCES = 4;
let AssistantService = class AssistantService {
    constructor(prisma, audit, llm, customers) {
        this.prisma = prisma;
        this.audit = audit;
        this.llm = llm;
        this.customers = customers;
        this.logger = new Logger('AssistantService');
    }
    async chat(actor, dto) {
        const conversationId = dto.conversationId ?? randomUUID();
        const tokens = tokenize(dto.message);
        const sources = await this.retrieve(tokens, dto.cropId);
        // Mirror CustomersService's ownership/role visibility scope (see
        // CustomersService#visibilityWhere) before letting the assistant read a
        // farmer's data — an agent must not be able to pull another agent's
        // customer context through the chat widget. 403s, not 404s: the actor
        // is authenticated, just not permitted to see this customer.
        if (dto.customerId) {
            await this.customers.assertVisible(dto.customerId, actor);
        }
        const customerContext = dto.customerId ? await this.customerContextLine(dto.customerId) : null;
        if (!this.llm.available) {
            await this.auditChat(actor, conversationId, dto.message, 'unavailable', []);
            return { status: 'unavailable', conversationId, answer: ASSISTANT_UNAVAILABLE, sources: [] };
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
            try {
                await this.auditChat(actor, conversationId, dto.message, 'answered', sources.map((s) => s.id), answer);
            }
            catch (auditErr) {
                this.logger.warn(`auditChat failed: ${auditErr instanceof Error ? auditErr.message : String(auditErr)}`);
            }
            return { status: 'answered', conversationId, answer, sources };
        }
        catch (error) {
            this.logger.warn(`assistant chat failed: ${error instanceof Error ? error.message : String(error)}`);
            await this.auditChat(actor, conversationId, dto.message, 'unavailable', []);
            return { status: 'unavailable', conversationId, answer: ASSISTANT_UNAVAILABLE, sources: [] };
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
    /** Reads the customer's crops/location to personalize the question context. */
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
            entityType: AuditEntityType.ASSISTANT,
            entityId: conversationId,
            entityLabel: question.slice(0, 80),
            action: AuditAction.ASSISTANT_CHAT,
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
AssistantService = __decorate([
    Injectable(),
    __param(2, Inject(ASSISTANT_LLM_PROVIDER)),
    __metadata("design:paramtypes", [typeof (_a = typeof PrismaService !== "undefined" && PrismaService) === "function" ? _a : Object, typeof (_b = typeof AuditService !== "undefined" && AuditService) === "function" ? _b : Object, typeof (_c = typeof LlmProvider !== "undefined" && LlmProvider) === "function" ? _c : Object, typeof (_d = typeof CustomersService !== "undefined" && CustomersService) === "function" ? _d : Object])
], AssistantService);
export { AssistantService };
