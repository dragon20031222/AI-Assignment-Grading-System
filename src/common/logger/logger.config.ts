//winstion是nodejs成熟的日志库
import { createLogger, format, transports } from 'winston';
//此文件用于配置全局日志的单个实例
//生产环境or开发环境
const isProduct = process.env.NODE_ENV === 'production';

//全局的日志单例，整个项目复用
export const logger = createLogger({
  level: 'info',
  format: isProduct
    ? format.json()
    : format.combine(format.colorize(), format.simple()),
  //日志输出的地方，这边我就直接输出到控制台，后面再看是否需要输出到文件
  transports: [new transports.Console()],
});
