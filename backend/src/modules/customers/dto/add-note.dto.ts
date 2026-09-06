import { IsString, MaxLength, MinLength } from 'class-validator';

export class AddCustomerNoteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  body: string;
}
