import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      // whitelist: true - 去除 dto 中没有定义的属性
      whitelist: true,
      // forbidNonWhitelisted: true - 如果请求包含未定义的属性，报错
      forbidNonWhitelisted: true,
      // 自动类型转换（如 string 转 number）
      transform: true,
    }),
  );
  //注册全局响应拦截器
  app.useGlobalInterceptors(new ResponseInterceptor());
  //注册全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    // 允许所有来源的 CORS 请求
    origin: '*',
    methods: '*',
    // 允许所有 CORS 请求头,允许Cookie
    credentials: true,
  });
  await app.listen(3000);
}
bootstrap();
