import {
  Controller,
  Get,
  Param,
  UseGuards,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ScoreService } from './score.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * 成绩管理控制器
 * 处理所有与成绩查看、统计相关的HTTP请求
 *
 * 前缀：/score
 * 所有接口都需要登录认证（JWT）
 *
 * 包含功能：
 * 1. 老师查看已发布作业的成绩统计列表
 * 2. 老师查看某个作业的所有学生成绩详情
 * 3. 学生查看自己的成绩列表
 */
@Controller('score')
@UseGuards(JwtAuthGuard)
export class ScoreController {
  constructor(private readonly scoreService: ScoreService) {}

  /**
   * 获取教师的作业成绩列表
   * GET /score/teacher/assignments
   *
   * 返回当前教师创建的所有作业的成绩统计信息
   * 用于老师端展示作业卡片列表
   *
   * 返回字段说明：
   * - submitted_count: 已提交人数
   * - not_submitted_count: 未提交人数
   * - class_total_count: 班级总人数
   * - class_average_score: 班级平均分（仅已批改的作业计算平均）
   */
  @Get('teacher/assignments')
  async getTeacherAssignmentGrades(@CurrentUser() user: any) {
    return this.scoreService.getTeacherAssignmentGrades(user.id);
  }

  /**
   * 获取作业的学生成绩详情
   * GET /score/assignment/:id
   *
   * 返回指定作业的所有学生的成绩信息
   * 用于老师点击作业卡片后查看详细成绩
   *
   * @param id - 作业ID
   *
   * 返回字段说明：
   * - assignment_info: 作业基本信息
   * - class_stats: 班级统计（平均分、最高分、最低分等）
   * - students: 学生成绩列表（包含排名）
   */
  @Get('assignment/:id')
  async getAssignmentGradeDetail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.scoreService.getAssignmentGradeDetail(id, user.id);
  }

  /**
   * 获取学生的成绩列表
   * GET /score/student/assignments
   *
   * 返回学生所在所有班级的作业成绩信息
   * 用于学生端展示我的成绩卡片列表
   *
   * 返回字段说明：
   * - my_score: 我的成绩
   * - class_average_score: 班级平均分
   * - class_rank: 班级排名
   * - submit_status: 提交状态
   */
  @Get('student/assignments')
  async getStudentGrades(@CurrentUser() user: any) {
    return this.scoreService.getStudentGrades(user.id);
  }

  /**
   * 导出作业成绩为 Excel 文件
   * GET /score/assignment/:id/export
   *
   * 教师点击导出按钮后，浏览器自动下载一个 .xlsx 文件，
   * 包含该作业所有学生的成绩详情和班级统计汇总。
   *
   * @param id - 作业ID
   * @param user - 当前登录用户（从 JWT 解析）
   * @param res - Express Response 对象，用于直接写入文件流
   *
   * 实现说明：
   * - 使用 @Res() 手动控制响应，绕过全局 ResponseInterceptor（因为二进制流不需要 JSON 包装）
   * - Content-Type 设为 Excel 的 MIME 类型，浏览器识别后自动触发下载
   * - Content-Disposition 中的 filename 支持中文（URL 编码），确保文件名不乱码
   */
  @Get('assignment/:id/export')
  async exportAssignmentGrades(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const { buffer, filename } =
      await this.scoreService.exportAssignmentGradesToExcel(id, user.id);

    // 设置响应头，告诉浏览器这是一个需要下载的 Excel 文件
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    // RFC 5987: filename* 支持 UTF-8 编码，解决中文文件名乱码问题
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    // 文件大小，方便浏览器显示下载进度
    res.setHeader('Content-Length', buffer.length);

    // 将 Excel 二进制数据写入响应流
    res.send(buffer);
  }
}
