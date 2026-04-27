import { Module } from '@nestjs/common';
import { GradingService } from './grading.service';

/**
 * AI批改模块
 * 提供AI作业批改的服务
 *
 * 已接入阿里云通义千问API (qwen-vl-plus视觉模型)
 * 支持文字、图片、选择题等多种答案类型的批改
 */
@Module({
  providers: [GradingService], // 提供GradingService
  exports: [GradingService], // 允许其他模块使用
})
export class GradingModule {}
