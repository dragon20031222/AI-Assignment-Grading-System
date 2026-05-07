import {
  Controller,
  Get,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
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
}
