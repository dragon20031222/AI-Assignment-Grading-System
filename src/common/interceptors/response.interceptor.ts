import {
  Injectable, // 标记这个类可以被依赖注入（Nest必备）
  NestInterceptor, // 拦截器接口，必须实现
  ExecutionContext, // 执行上下文 = 整个请求的信息（request/response）
  CallHandler, // 调用处理器，用来继续执行原本的接口
} from '@nestjs/common';

import { Observable } from 'rxjs'; // 响应式编程库，Nest底层用它处理异步
import { map } from 'rxjs/operators'; // 转换数据的工具
import { ResponseDto } from '../dto/response.dto'; // 你的统一返回格式类

/**
 * 全局响应拦截器
 * 职责：将所有成功响应用统一格式包装
 * 执行时机：Controller 返回数据之后，响应给前端之前
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ResponseDto<T>
> {
  /**
   * intercept 是拦截器的核心方法
   * @param context - 执行上下文，可以获取请求信息
   * @param next - 指向下一个处理器的可观察对象
   **/
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseDto<T>> {
    const request = context.switchToHttp().getRequest();
    // 2. 使用 pipe() 转换响应数据
    // map 操作符：在 Observable 发出值之前对其进行处理
    return next.handle().pipe(
      map((data) => ({
        code: 200,
        message: 'success',
        data,
        timeStamp: new Date().toISOString(),
        path: request.url,
      })),
    );
  }
}
