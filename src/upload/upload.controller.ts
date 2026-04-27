import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * 文件上传控制器
 * 处理作业文件上传相关请求
 *
 * 前缀：/upload
 */
@Controller('upload')
@UseGuards(JwtAuthGuard) // 所有上传接口都需要登录
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * 上传单张图片
   * POST /upload/image
   *
   * 用于学生提交作业时上传单张图片
   *
   * @param file - 上传的图片文件
   * @returns { url: 文件访问路径 }
   */
  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('请上传图片文件');
    }

    const filename = this.uploadService.extractFilename(file.path);
    const url = this.uploadService.getFileUrl(filename);

    return {
      url,
      filename,
      originalname: file.originalname,
      size: file.size,
    };
  }

  /**
   * 上传多张图片
   * POST /upload/images
   *
   * 用于学生提交作业时一次性上传多张图片
   *
   * @param files - 上传的图片文件数组
   * @returns 上传成功的文件列表
   */
  @Post('images')
  @UseInterceptors(FilesInterceptor('files', 10)) // 最多10张图片
  async uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('请上传至少一张图片');
    }

    const results = files.map((file) => {
      const filename = this.uploadService.extractFilename(file.path);
      const url = this.uploadService.getFileUrl(filename);
      return {
        url,
        filename,
        originalname: file.originalname,
        size: file.size,
      };
    });

    return {
      count: results.length,
      files: results,
    };
  }
}
