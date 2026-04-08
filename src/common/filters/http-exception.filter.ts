import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * 全局异常过滤器
 * 职责：捕获所有未被处理的异常，统一返回错误响应格式
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  /**
   * catch 方法：捕获异常并处理
   * @param exception 捕获到的异常对象
   * @param host 参数主机，提供访问请求/响应对象的能力
   */
  catch(exception: unknown, host: ArgumentsHost) {
    // 获取 HTTP 上下文
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 确定状态码和错误信息
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    let code = 500;

    if (exception instanceof HttpException) {
      // 如果是 NestJS 的 HttpException
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // 兼容不同格式的异常响应
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        code = (exceptionResponse as any).code || status;
      }
    } else if (exception instanceof Error) {
      // 如果是普通 Error
      message = exception.message;
    }

    // 记录错误日志
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    // 返回统一格式的错误响应
    response.status(status).json({
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
