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
import { CustomersService } from './customers.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  TransferCustomerDto,
  CustomerFiltersDto,
} from './dto/customers.dto';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Customers')
@ApiBearerAuth('access-token')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo cliente' })
  create(@CurrentUser() actor: CurrentUserPayload, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(actor, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista clientes (filtrados por hierarquia)' })
  findAll(@CurrentUser() actor: CurrentUserPayload, @Query() filters: CustomerFiltersDto) {
    return this.customersService.findAll(actor, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do cliente' })
  findOne(@CurrentUser() actor: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOne(actor, id);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Timeline de eventos do cliente' })
  timeline(@CurrentUser() actor: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.getTimeline(actor, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza dados do cliente' })
  update(
    @CurrentUser() actor: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(actor, id, dto);
  }

  @Post(':id/transfer')
  @ApiOperation({ summary: 'Transfere cliente para outro vendedor (somente supervisor/manager)' })
  transfer(
    @CurrentUser() actor: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferCustomerDto,
  ) {
    return this.customersService.transfer(actor, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete do cliente' })
  remove(@CurrentUser() actor: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.remove(actor, id);
  }
}
