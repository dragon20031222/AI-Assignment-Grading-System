import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

/**
 * 文件上传服务
 * 处理文件上传相关业务
 */
@Injectable()
export class UploadService {
  /**
   * 获取文件访问URL
   * 根据存储的文件名生成访问路径
   *
   * @param filename - 存储的文件名
   * @returns 访问URL路径
   */
  getFileUrl(filename: string): string {
    return `/uploads/${filename}`;
  }

  /**
   * 从文件路径提取文件名
   *
   * @param filepath - 完整文件路径
   * @returns 文件名
   */
  extractFilename(filepath: string): string {
    const parts = filepath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1];
  }

  /**
   * 生成唯一文件名
   * 使用UUID确保文件名唯一
   *
   * @param originalname - 原始文件名
   * @returns 唯一文件名
   */
  generateUniqueFilename(originalname: string): string {
    const ext = originalname.split('.').pop();
    return `${uuidv4()}.${ext}`;
  }
}
