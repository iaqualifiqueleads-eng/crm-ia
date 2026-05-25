import { Global, Module } from '@nestjs/common';
import { ForecastService } from './forecast.service';

@Global()
@Module({
  providers: [ForecastService],
  exports: [ForecastService],
})
export class ForecastModule {}
