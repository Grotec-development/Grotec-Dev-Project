import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;

  /** Optional farmer whose context (crops/location) the assistant should consider. */
  @IsOptional()
  @IsUUID()
  customerId?: string;

  /** Optional crop to bias retrieval (auto-passed from the calling workspace). */
  @IsOptional()
  @IsUUID()
  cropId?: string;

  /** Client-generated conversation id (uuid). Omitted → server generates one. */
  @IsOptional()
  @IsUUID()
  conversationId?: string;
}
