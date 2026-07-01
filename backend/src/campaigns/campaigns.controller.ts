import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, CampaignPreviewDto } from './dto/campaigns.dto';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Campaigns')
@ApiBearerAuth('access-token')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post('preview')
  @ApiOperation({ summary: 'Pré-visualiza clientes elegíveis sem criar campanha' })
  preview(@CurrentUser() actor: CurrentUserPayload, @Body() dto: CampaignPreviewDto) {
    return this.campaignsService.preview(actor, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Cria e executa uma campanha de disparo' })
  create(@CurrentUser() actor: CurrentUserPayload, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(actor, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista campanhas criadas pelo usuário' })
  findAll(@CurrentUser() actor: CurrentUserPayload) {
    return this.campaignsService.findAll(actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe da campanha com lista de clientes' })
  findOne(
    @CurrentUser() actor: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaignsService.findOne(actor, id);
  }

  @Patch(':id/pause')
  @ApiOperation({ summary: 'Pausa a campanha (jobs pendentes aguardam reativação)' })
  pause(
    @CurrentUser() actor: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaignsService.pause(actor, id);
  }

  @Patch(':id/resume')
  @ApiOperation({ summary: 'Retoma campanha pausada' })
  resume(
    @CurrentUser() actor: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaignsService.resume(actor, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancela e deleta a campanha (jobs pendentes são removidos da fila)' })
  remove(
    @CurrentUser() actor: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaignsService.remove(actor, id);
  }

  @Delete(':id/customers/:customerId')
  @ApiOperation({ summary: 'Remove um cliente da campanha e cancela seu job' })
  removeCustomer(
    @CurrentUser() actor: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.campaignsService.removeCustomer(actor, id, customerId);
  }
}
