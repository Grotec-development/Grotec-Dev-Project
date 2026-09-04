import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AuditAction, AuditEntityType } from '@grotec/shared';
import type { AuthEmployee } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ASSISTANT_LLM_PROVIDER, LlmProvider } from './llm/llm-provider';
import type { ChatDto } from './dto/chat.dto';

export interface AssistantSource {
  id: string;
  cropId: string;
  cropName: string;
  problemKeywords: string[];
  recommendedProducts: string[];
  usageGuidance: string | null;
}

export const ASSISTANT_UNAVAILABLE =
  'The assistant is temporarily unavailable (no AI provider is configured in this environment). Please try again later, or ask the relationship manager.';

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'what', 'which', 'should', 'would', 'how', 'why', 'when', 'where',
  'recommend', 'recommended', 'suggest', 'suggestion', 'please', 'need', 'help', 'tell', 'advise',
  'about', 'this', 'that', 'they', 'their', 'them', 'are', 'was', 'were', 'you', 'your', 'have',
  'has', 'had', 'there', 'some', 'any', 'from', 'crop', 'crops', 'farmer', 'farmers', 'i', 'my',
]);

const COMPANY_CONTEXT_SYSTEM_PROMPT = `You are "Grotec Assistant", the in-CRM advisor for Grotec Agro Products (grotecagro.com), an organic/bio agri-inputs manufacturer in Dharmapuri, Tamil Nadu, India, serving farmers since 2007 (products regulated under the Fertilizer Control Order, 1985).
Product lines: bio-fertilizers / bio-inoculants (Azos, Azotob, Rhizob, PHOS, Micromix, Bio Jeevan PF, Bio Jeevan TV); "Jeevan Sakthi" organic growth & protection (Ultra Action +, Trishul, Asthra, Sanjeevini Gel); plus Raksha, Thavam and Organic Fertilizer (enriched organic manure). All are 100% organic, biodegradable inputs that improve yield, soil structure/fertility, pest & disease resistance and stress tolerance.
You answer GROTEC telecallers mid-call about a farmer's crop problem. Use ONLY the guidance records supplied in <guidance>. If none are relevant, say so plainly and suggest checking with the relationship manager. Never invent products, dosages, or agronomic claims. Be concise (2-6 sentences), practical and farmer-friendly. Include the usage stage/method from the guidance when present, and always tell the caller to follow the product label.`;

function tokenize(message: string): string[] {
  return message
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

const MAX_SOURCES = 3;

@Injectable()
export class AssistantService {
  private readonly logger = new Logger('AssistantService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(ASSISTANT_LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  async chat(actor: AuthEmployee, dto: ChatDto): Promise<unknown> {
    const conversationId = dto.conversationId ?? randomUUID();
    const tokens = tokenize(dto.message);
    const sources = await this.retrieve(tokens, dto.cropId);
    const customerContext = dto.customerId ? await this.customerContextLine(dto.customerId) : null;

    if (!this.llm.available) {
      await this.auditChat(actor, conversationId, dto.message, 'unavailable', []);
      return { status: 'unavailable', conversationId, answer: ASSISTANT_UNAVAILABLE, sources: [] };
    }

    try {
      const guidanceBlock = JSON.stringify(
        sources.map((s) => ({
          crop: s.cropName,
          problemKeywords: s.problemKeywords,
          recommendedProducts: s.recommendedProducts,
          usageGuidance: s.usageGuidance,
        })),
      );
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
    } catch (error) {
      this.logger.warn(`assistant chat failed: ${error instanceof Error ? error.message : String(error)}`);
      await this.auditChat(actor, conversationId, dto.message, 'unavailable', []);
      return { status: 'unavailable', conversationId, answer: ASSISTANT_UNAVAILABLE, sources: [] };
    }
  }

  private async retrieve(tokens: string[], cropId?: string): Promise<AssistantSource[]> {
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
    if (rows.length === 0) return [];

    const scored: Array<{ score: number; row: (typeof rows)[number] }> = [];
    for (const row of rows) {
      let score = 0;
      if (cropId && row.cropId === cropId) score += 10;
      const haystack = [row.crop.name, row.crop.code, ...row.problemKeywords, ...row.recommendedProducts]
        .join(' ')
        .toLowerCase();
      for (const token of tokens) {
        if (haystack.includes(token)) {
          score += row.crop.name.toLowerCase().includes(token) ? 2 : 1;
        }
      }
      if (score > 0) scored.push({ score, row });
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
  private async customerContextLine(customerId: string): Promise<string | null> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: {
        fullName: true,
        crops: { where: { deletedAt: null }, select: { crop: { select: { name: true } } } },
        locations: { where: { isPrimary: true, deletedAt: null }, take: 1, select: { village: true, district: true } },
      },
    });
    if (!customer) return null;
    const crops = customer.crops.map((c) => c.crop.name).join(', ') || 'not recorded';
    const place = customer.locations[0];
    const location = place ? [place.village, place.district].filter(Boolean).join(', ') : null;
    const parts = [`${customer.fullName} — crops: ${crops}`];
    if (location) parts.push(`location: ${location}`);
    return parts.join('; ');
  }

  private async auditChat(actor: AuthEmployee, conversationId: string, question: string, status: 'answered' | 'unavailable', sourceIds: string[], answer?: string): Promise<void> {
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
}
