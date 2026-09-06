import { Global, Module } from '@nestjs/common';
import { DomainEventService } from './domain-event.service';
import { OutboxEventHandlers } from './event-handlers';
import { OutboxWorker } from './outbox-worker';

@Global()
@Module({
  providers: [DomainEventService, OutboxWorker, OutboxEventHandlers],
  exports: [DomainEventService, OutboxWorker],
})
export class OutboxModule {}
