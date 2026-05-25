import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InteractionsService } from './interactions.service';
import {
  CreateInteractionDto,
  IncomingMessageDto,
  InteractionFiltersDto,
} from './dto/interactions.dto';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Interactions')
@ApiBearerAuth('access-token')
@Controller('interactions')
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Post()
  @ApiOperation({ summary: 'Cria interação manual (nota, registro de ligação, etc.)' })
  create(@CurrentUser() actor: CurrentUserPayload, @Body() dto: CreateInteractionDto) {
    return this.interactionsService.create(actor, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista interações' })
  findAll(@CurrentUser() actor: CurrentUserPayload, @Query() filters: InteractionFiltersDto) {
    return this.interactionsService.findAll(actor, filters);
  }

  @Get('customer/:customerId/timeline')
  @ApiOperation({ summary: 'Timeline completa de interações de um cliente' })
  timeline(
    @CurrentUser() actor: CurrentUserPayload,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.interactionsService.getCustomerTimeline(actor, customerId);
  }

  // ------------------------------------------------------------
  // WEBHOOK público — recebe mensagens vindas do WhatsApp.
  // Em produção, este endpoint deve ser protegido por uma chave
  // secreta (a ser implementada quando plugar o WhatsApp real).
  // ------------------------------------------------------------
  @Public()
  @Post('webhook/incoming')
  @ApiOperation({ summary: 'Webhook público para mensagens recebidas (WhatsApp/IA)' })
  ingest(@Body() dto: IncomingMessageDto) {
    return this.interactionsService.ingestIncoming(dto);
  }
}
