import { Global, Module } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { InteractionsController } from './interactions.controller';

@Global()
@Module({
  controllers: [InteractionsController],
  providers: [InteractionsService],
  exports: [InteractionsService],
})
export class InteractionsModule {}
