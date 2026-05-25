import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto, UpdateTemplateDto, TemplateFiltersDto } from './dto/templates.dto';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Templates')
@ApiBearerAuth('access-token')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @ApiOperation({ summary: 'Cria template de mensagem (manager/supervisor)' })
  create(@CurrentUser() actor: CurrentUserPayload, @Body() dto: CreateTemplateDto) {
    return this.templatesService.create(actor, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista templates' })
  findAll(@CurrentUser() actor: CurrentUserPayload, @Query() filters: TemplateFiltersDto) {
    return this.templatesService.findAll(actor, filters);
  }

  @Get(':id')
  findOne(@CurrentUser() actor: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.findOne(actor, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(actor, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() actor: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.remove(actor, id);
  }
}
