import { Global, Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentRuntimeService } from './agent-runtime.service';
import { ToolRegistry } from './tools/tool.registry';
import { MessagingModule } from '../messaging/messaging.module';
import {
  RegisterOrderTool,
  ScheduleTaskTool,
  UpdateCustomerNotesTool,
  TransferToHumanTool,
  UpdateReplenishmentForecastTool,
  MarkNotInterestedTool,
  MarkWellStockedTool,
} from './tools/tools.implementations';

@Global()
@Module({
  imports: [MessagingModule],
  controllers: [AgentsController],
  providers: [
    AgentsService,
    AgentRuntimeService,
    ToolRegistry,
    RegisterOrderTool,
    ScheduleTaskTool,
    UpdateCustomerNotesTool,
    TransferToHumanTool,
    UpdateReplenishmentForecastTool,
    MarkNotInterestedTool,
    MarkWellStockedTool
  ],
  exports: [AgentsService, AgentRuntimeService, ToolRegistry],
})
export class AgentsModule {}
