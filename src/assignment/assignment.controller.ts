import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * 作业控制器
 * 处理所有与作业相关的HTTP请求
 *
 * 前缀：/assignment
 * 所有接口都需要登录认证（JWT）
 */
@Controller('assignment')
@UseGuards(JwtAuthGuard) // 所有路由都需要JWT认证
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  /**
   * 创建作业
   * POST /assignment/create
   *
   * 教师创建新作业
   * 需要传入作业信息和题目列表
   */
  @Post('create')
  async createAssignment(
    @Body() createDto: CreateAssignmentDto,
    @CurrentUser() user: any,
  ) {
    return this.assignmentService.createAssignment(createDto, user.id);
  }

  /**
   * 获取教师的作业列表
   * GET /assignment/teacher/list
   *
   * 返回当前教师创建的所有作业
   */
  @Get('teacher/list')
  async getTeacherAssignments(@CurrentUser() user: any) {
    return this.assignmentService.getTeacherAssignments(user.id);
  }

  /**
   * 获取学生的作业列表
   * GET /assignment/student/list
   *
   * 返回学生所在所有班级的作业
   * 包含是否已提交、是否过期等信息
   */
  @Get('student/list')
  async getStudentAssignments(@CurrentUser() user: any) {
    return this.assignmentService.getStudentAssignments(user.id);
  }

  /**
   * 获取作业详情
   * GET /assignment/:id
   *
   * 返回作业的完整信息，包括题目列表
   * 如果是学生登录，同时返回该学生的提交情况
   *
   * @param id - 作业ID
   */
  @Get(':id')
  async getAssignmentDetail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.assignmentService.getAssignmentDetail(id, user.id);
  }

  /**
   * 获取作业详情（不带提交信息）
   * GET /assignment/:id/detail
   *
   * 返回作业的完整信息，包括题目列表
   * 不返回任何学生的提交情况
   * 用于查看作业（做题前）
   *
   * @param id - 作业ID
   */
  @Get(':id/detail')
  async getAssignmentDetailWithoutSubmit(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.assignmentService.getAssignmentDetail(id);
  }

  /**
   * 提交作业
   * POST /assignment/submit
   *
   * 学生提交作业答案
   * 提交后会自动调用AI进行批改
   */
  @Post('submit')
  async submitAssignment(
    @Body() submitDto: SubmitAssignmentDto,
    @CurrentUser() user: any,
  ) {
    return this.assignmentService.submitAssignment(submitDto, user.id);
  }

  /**
   * 删除作业
   * DELETE /assignment/:id
   *
   * 教师删除自己创建的作业
   * 会同时删除关联的题目和所有提交记录
   *
   * @param id - 作业ID
   */
  @Delete(':id')
  async deleteAssignment(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.assignmentService.deleteAssignment(id, user.id);
  }

  /**
   * 获取作业的提交列表
   * GET /assignment/:id/submits
   *
   * 教师查看某个作业的所有学生提交情况
   *
   * @param id - 作业ID
   */
  @Get(':id/submits')
  async getAssignmentSubmits(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.assignmentService.getAssignmentSubmits(id, user.id);
  }
}
