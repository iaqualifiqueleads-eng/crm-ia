import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista notificações do usuário logado' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  list(
    @CurrentUser() actor: CurrentUserPayload,
    @Query() pagination: PaginationDto,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.listForUser(actor, pagination, unreadOnly === 'true');
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Contador de notificações não lidas' })
  unreadCount(@CurrentUser() actor: CurrentUserPayload) {
    return this.notificationsService.unreadCount(actor);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marca uma notificação como lida' })
  markRead(@CurrentUser() actor: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.markAsRead(actor, id);
  }

  @Post('mark-all-read')
  @ApiOperation({ summary: 'Marca todas as notificações como lidas' })
  markAllRead(@CurrentUser() actor: CurrentUserPayload) {
    return this.notificationsService.markAllAsRead(actor);
  }
}
