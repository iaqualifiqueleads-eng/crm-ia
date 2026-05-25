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
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderDto, OrderFiltersDto } from './dto/orders.dto';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Orders')
@ApiBearerAuth('access-token')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Registra um novo pedido e recalcula a previsão' })
  create(@CurrentUser() actor: CurrentUserPayload, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(actor, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista pedidos (filtrados por hierarquia)' })
  findAll(@CurrentUser() actor: CurrentUserPayload, @Query() filters: OrderFiltersDto) {
    return this.ordersService.findAll(actor, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do pedido' })
  findOne(@CurrentUser() actor: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findOne(actor, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza pedido' })
  update(
    @CurrentUser() actor: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.update(actor, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Exclui (soft delete) o pedido' })
  remove(@CurrentUser() actor: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.remove(actor, id);
  }
}
