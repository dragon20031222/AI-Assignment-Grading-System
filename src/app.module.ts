import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql', // 数据库类型
      host: 'localhost', // 地址
      port: 3306, // 端口
      username: 'root', // 你的MySQL用户名
      password: '1887415157Long.', // 你的MySQL密码
      database: 'ai_check_assignment', // 数据库名（必须先手动创建）
      autoLoadEntities: true, // 自动加载实体
      synchronize: true, // 自动同步表结构（开发用！生产关闭）
      logging: true, // 打印 SQL 日志
    }),
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
