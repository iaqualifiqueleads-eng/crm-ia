import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { OrdersModule } from './orders/orders.module';
import { ForecastModule } from './forecast/forecast.module';

// Fase 1.2
import { MessagingModule } from './messaging/messaging.module';
import { AiModule } from './ai/ai.module';
import { AutomationModule } from './automation/automation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TemplatesModule } from './templates/templates.module';
import { TasksModule } from './tasks/tasks.module';
import { InteractionsModule } from './interactions/interactions.module';
import { WorkersModule } from './workers/workers.module';
import { DashboardModule } from './dashboard/dashboard.module';

// Campanhas
import { CampaignsModule } from './campaigns/campaigns.module';

// Fase 3 — agentes + WhatsApp real
import { AgentsModule } from './agents/agents.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';

import { envValidation } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: envValidation,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),

    // Infra
    PrismaModule,

    // Fase 1.1
    AuthModule,
    UsersModule,
    CustomersModule,
    OrdersModule,
    ForecastModule,

    // Fase 1.2
    MessagingModule,
    AiModule,
    AutomationModule,
    NotificationsModule,
    TemplatesModule,
    TasksModule,
    InteractionsModule,
    DashboardModule,
    WorkersModule,

    // Campanhas
    CampaignsModule,

    // Fase 3
    AgentsModule,
    WhatsAppModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
