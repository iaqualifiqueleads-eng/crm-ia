import { Global, Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentRuntimeService } from './agent-runtime.service';
import { ToolRegistry } from './tools/tool.registry';
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
