import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { TablesModule } from './tables/tables.module';
import { SessionsModule } from './sessions/sessions.module';
import { OrdersModule } from './orders/orders.module';
import { ClipperModule } from './clipper/clipper.module';

@Module({
  imports: [
    AuthModule,
    TablesModule,
    SessionsModule,
    OrdersModule,
    ClipperModule
  ]
})
export class AppModule {}
