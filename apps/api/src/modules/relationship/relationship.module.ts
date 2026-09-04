import { Module } from '@nestjs/common';
import { RelationshipController } from './relationship.controller';
import { RelationshipService } from './relationship.service';

@Module({
  controllers: [RelationshipController],
  providers: [RelationshipService],
})
export class RelationshipModule {}
