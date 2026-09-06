import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { CALL_OUTCOMES, type CallOutcome, type NextAction } from '@grotec/shared';

/**
 * Records one of exactly three call outcomes (PRD §6.3.6). Outcome and
 * nextAction are separate fields (§11.1): nextAction is allowed only for
 * INTERESTED, where exactly one of CALLBACK | SALES is required (no default).
 */
export class RecordOutcomeDto {
  @IsIn([...CALL_OUTCOMES])
  outcome: CallOutcome;

  @IsOptional()
  @IsIn(['CALLBACK', 'SALES'])
  nextAction?: NextAction;

  /** YYYY-MM-DD (local business date). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'followUpDate must be YYYY-MM-DD' })
  followUpDate?: string;

  /** HH:mm (24h, local business time). */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'followUpTime must be HH:mm' })
  followUpTime?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  followUpNote?: string;
}
