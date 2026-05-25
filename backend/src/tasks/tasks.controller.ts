import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto, TaskFiltersDto } from './dto/tasks.dto';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Tasks')
@ApiBearerAuth('access-token')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Cria tarefa' })
  create(@CurrentUser() actor: CurrentUserPayload, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(actor, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista tarefas (com scope=today|overdue|upcoming)' })
  findAll(@CurrentUser() actor: CurrentUserPayload, @Query() filters: TaskFiltersDto) {
    return this.tasksService.findAll(actor, filters);
  }

  @Get(':id')
  findOne(@CurrentUser() actor: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findOne(actor, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(actor, id, dto);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Marca tarefa como concluída' })
  complete(@CurrentUser() actor: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.complete(actor, id);
  }

  @Delete(':id')
  remove(@CurrentUser() actor: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.remove(actor, id);
  }
}
