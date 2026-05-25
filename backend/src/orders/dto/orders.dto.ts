import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { OrderChannel } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class OrderItemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  productSku?: string;

  @ApiProperty() @IsString() @MaxLength(200)
  productName: string;

  @ApiProperty() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0)
  quantity: number;

  @ApiPropertyOptional({ default: 'UN' })
  @IsOptional() @IsString() @MaxLength(10)
  unit?: string;

  @ApiProperty() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  unitPrice: number;
}

export class CreateOrderDto {
  @ApiProperty() @IsUUID() customerId: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  orderNumber?: string;

  @ApiProperty({ description: 'Data efetiva do pedido (ISO 8601)' })
  @Type(() => Date) @IsDate()
  orderedAt: Date;

  @ApiPropertyOptional({ enum: OrderChannel, default: OrderChannel.OTHER })
  @IsOptional() @IsEnum(OrderChannel)
  channel?: OrderChannel;

  @ApiPropertyOptional() @IsOptional() @IsString()
  notes?: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

export class UpdateOrderDto extends PartialType(CreateOrderDto) {}

export class OrderFiltersDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() customerId?: string;
  @ApiPropertyOptional({ enum: OrderChannel }) @IsOptional() @IsEnum(OrderChannel) channel?: OrderChannel;
}
