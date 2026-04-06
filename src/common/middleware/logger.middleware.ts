//此文件的主要作用：
//Nest中间件，拦截所有 HTTP 请求，记录请求
//响应的全量信息（链路 ID、IP、耗时、状态码、脱敏请求体
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Response, Request, NextFunction } from 'express';
import { logger } from '../logger/logger.config';
//导入uuid的v4方法：生成唯一的traceId，到时候追踪更好追踪
import { v4 as uuidv4 } from 'uuid';
import { timeStamp } from 'console';

// 定义需要脱敏的敏感字段列表（企业级必做，防止密码/令牌泄露）
// 这些字段在日志中会被替换为***masked***
const SENSITIVE_FIELDS = [
  'password', // 密码
  'token', // 令牌
  'access_token', // 访问令牌
  'refresh_token', // 刷新令牌
  'secret', // 密钥
  'authorization', // 请求头中的授权字段
];

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  //中间件需要实现use接口
  // 然后就是req请求对象，URL，方法，请求体，请求头等等
  //res响应对象，状态码，响应头，响应体
  //next下一步函数，调用之后才会执行后面的流程
  use(req: any, res: any, next: NextFunction) {
    const traceId = uuidv4();
    (req as any).traceId = traceId;
    const { method, originalUrl: url, ip, headers } = req;
    const userAgent = headers['user-agent'] || 'unknown';
    const realIp = headers['x-forwarded-for'] || ip || '0.0.0.0';
    const requestBody = this.maskSensitive(req.body);
    const startTime = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      const logData = {
        traceId,
        timeStamp: new Date().toISOString(),
        method,
        url,
        ip: realIp,
        userAgent,
        statusCode,
        durationMs: duration,
        request: requestBody,
      };
      if (statusCode >= 500) {
        logger.error('服务器异常or请求异常', logData);
      } else if (statusCode >= 400) {
        logger.warn('请求失败', logData);
      } else {
        logger.info('请求完成', logData);
      }
    });
    next();
  }
  private maskSensitive(body: any) {
    if (!body || typeof body !== 'object') return body;
    const masked = { ...body };
    for (const key of SENSITIVE_FIELDS) {
      if (masked[key]) masked[key] = '***masked***';
    }
    return masked;
  }
}
