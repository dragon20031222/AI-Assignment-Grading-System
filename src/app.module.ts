import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { AuthModule } from './auth/auth.module';
import { ClassModule } from './class/class.module';
import { AssignmentModule } from './assignment/assignment.module';
import { GradingModule } from './grading/grading.module';
import { UploadModule } from './upload/upload.module';
import { ScoreModule } from './score/score.module';

@Module({
  imports: [
    // 配置 ConfigModule，自动读取 .env 文件
    ConfigModule.forRoot({
      isGlobal: true, // 全局可用，无需在每个模块导入
    }),
    // 配置定时任务模块，用于截止时间自动查重
    ScheduleModule.forRoot(),
    // 配置静态资源服务，使 /uploads/* 可以访问实际文件
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'ai_check_assignment',
      autoLoadEntities: true,
      synchronize: true,
      logging: true,
    }),
    UserModule,
    AuthModule,
    ClassModule,
    AssignmentModule,
    GradingModule,
    UploadModule,
    ScoreModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
