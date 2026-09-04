import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface AttemptBucket {
  count: number;
  windowStart: number;
}

/**
 * In-memory login rate limiter (single-instance). Persisted/distributed limiting
 * belongs to the Month 5 hardening pass. Keyed by email + IP.
 */
@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, AttemptBucket>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(config: ConfigService) {
    this.maxAttempts = Number(config.get<string>('LOGIN_MAX_ATTEMPTS') ?? 5);
    this.windowMs = Number(config.get<string>('LOGIN_WINDOW_MINUTES') ?? 15) * 60 * 1000;
  }

  private key(email: string, ip: string): string {
    return `${email.toLowerCase()}|${ip}`;
  }

  isLimited(email: string, ip: string): boolean {
    const bucket = this.buckets.get(this.key(email, ip));
    if (!bucket) return false;
    if (Date.now() - bucket.windowStart >= this.windowMs) {
      this.buckets.delete(this.key(email, ip));
      return false;
    }
    return bucket.count >= this.maxAttempts;
  }

  recordFailure(email: string, ip: string): void {
    const key = this.key(email, ip);
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart >= this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now });
    } else {
      bucket.count += 1;
    }
  }

  reset(email: string, ip: string): void {
    this.buckets.delete(this.key(email, ip));
  }
}
