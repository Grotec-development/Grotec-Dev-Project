 import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEmployeeDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  fileType: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  @IsNumber()
  fileSize: number;

  @IsOptional()
  @IsNumber()
  fileSizeBytes?: number;

  @IsString()
  @IsNotEmpty()
  fileUrl: string;
}
