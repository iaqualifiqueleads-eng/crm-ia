import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TaskPriority, TaskStatus, TaskType } from '@prisma/client';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateTaskDto {
  @ApiProperty() @IsString() @MaxLength(200) title: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiPropertyOptional({ enum: TaskType, default: TaskType.FOLLOW_UP })
  @IsOptional() @IsEnum(TaskType)
  type?: TaskType;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsOptional() @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Date) @IsDate()
  dueDate?: Date;

  @ApiPropertyOptional({ description: 'Se omitido, é atribuída ao usuário logado' })
  @IsOptional() @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() customerId?: string;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional() @IsEnum(TaskStatus)
  status?: TaskStatus;
}

export class TaskFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TaskStatus }) @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @ApiPropertyOptional({ enum: TaskPriority }) @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @ApiPropertyOptional({ enum: TaskType }) @IsOptional() @IsEnum(TaskType) type?: TaskType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() customerId?: string;
  @ApiPropertyOptional({ description: 'today | overdue | upcoming' })
  @IsOptional() @IsString() scope?: 'today' | 'overdue' | 'upcoming';
}
