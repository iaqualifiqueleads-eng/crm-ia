import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AgentsService } from './agents.service';
import {
  CreateAgentDto, UpdateAgentDto, AgentFiltersDto, PlaygroundMessageDto,
} from './dto/agents.dto';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Agents')
@ApiBearerAuth('access-token')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Lista providers, modelos e tools disponíveis' })
  catalog() {
    return this.agentsService.getCatalog();
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Cria agente de IA (manager/supervisor)' })
  create(@CurrentUser() actor: CurrentUserPayload, @Body() dto: CreateAgentDto) {
    return this.agentsService.create(actor, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista agentes' })
  findAll(@CurrentUser() actor: CurrentUserPayload, @Query() filters: AgentFiltersDto) {
    return this.agentsService.findAll(actor, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do agente' })
  findOne(@CurrentUser() actor: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.agentsService.findOne(actor, id);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Atualiza agente' })
  update(
    @CurrentUser() actor: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentDto,
  ) {
    return this.agentsService.update(actor, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Soft delete' })
  remove(@CurrentUser() actor: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.agentsService.remove(actor, id);
  }

  @Post(':id/playground')
  @ApiOperation({ summary: 'Conversa com o agente em ambiente isolado (não envia mensagens reais)' })
  playground(
    @CurrentUser() actor: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlaygroundMessageDto,
  ) {
    return this.agentsService.playground(actor, id, dto);
  }

  @Get(':id/usage')
  @ApiOperation({ summary: 'Estatísticas de uso (tokens, custo, latência)' })
  usage(
    @CurrentUser() actor: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('days') days?: string,
  ) {
    return this.agentsService.usageStats(actor, id, days ? Number(days) : 30);
  }
}
