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
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, ResetUserPasswordDto } from './dto/users.dto';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Retorna o perfil do usuário logado' })
  me(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.me(user);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Cria um novo supervisor ou vendedor' })
  create(@CurrentUser() actor: CurrentUserPayload, @Body() dto: CreateUserDto) {
    return this.usersService.create(actor, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista usuários conforme escopo da hierarquia' })
  @ApiQuery({ name: 'role', enum: UserRole, required: false })
  findAll(
    @CurrentUser() actor: CurrentUserPayload,
    @Query() pagination: PaginationDto,
    @Query('role') role?: UserRole,
  ) {
    return this.usersService.findAll(actor, pagination, role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de um usuário' })
  findOne(@CurrentUser() actor: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(actor, id);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Atualiza dados de um usuário' })
  update(
    @CurrentUser() actor: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(actor, id, dto);
  }

  @Post(':id/reset-password')
  @Roles(UserRole.MANAGER, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Reseta a senha de um subordinado' })
  resetPassword(
    @CurrentUser() actor: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetUserPasswordDto,
  ) {
    return this.usersService.resetPassword(actor, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Desativa (soft delete) um usuário' })
  deactivate(@CurrentUser() actor: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.deactivate(actor, id);
  }
}
