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
import { ClassService } from './class.service';
import { CreateClassDto } from './dto/create-class.dto';
import { JoinClassDto } from './dto/join-class.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('class')
@UseGuards(JwtAuthGuard)
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  @Post('create')
  async createClass(
    @Body() createClassDto: CreateClassDto,
    @CurrentUser() user: any,
  ) {
    return this.classService.createClass(createClassDto, user.id);
  }
  // 加入班级
  // 只有学生才能加入班级
  @Post('join')
  async joinClass(
    @Body() joinClassDto: JoinClassDto,
    @CurrentUser() user: any,
  ) {
    return this.classService.joinClass(joinClassDto, user.id);
  }

  /**
   * 教师获取班级详情（含学生列表）
   * GET /class/:id/detail
   *
   * 返回班级完整信息：
   * - 班级基本信息（名称、描述、邀请码、创建者）
   * - 统计数据（学生人数、作业数量）
   * - 学生列表（学号、姓名、邮箱、是否班长、加入时间）
   *
   * 只有该班级的教师才能查看
   */
  @Get(':id/detail')
  async getClassDetailForTeacher(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.classService.getClassDetailForTeacher(id, user.id);
  }

  // 获取班级详情
  // 只有班级的教师才能获取班级详情
  // 只有班级的学生才能获取班级详情
  @Get(':id')
  async getClassById(@Param('id', ParseIntPipe) id: number) {
    return this.classService.getClassById(id);
  }
  // 获取教师的班级列表
  @Get('teacher/classes')
  async getTeacherClasses(@CurrentUser() user: any) {
    return this.classService.getTeacherClasses(user.id);
  }
  // 获取学生的班级列表
  @Get('student/classes')
  async getStudentClasses(@CurrentUser() user: any) {
    return this.classService.getStudentClasses(user.id);
  }
  // 获取班级的学生列表
  // 只有班级的教师才能获取班级的学生列表
  @Get(':id/students')
  async getClassStudents(@Param('id', ParseIntPipe) id: number) {
    return this.classService.getClassStudents(id);
  }
  // 获取班级的教师列表
  // 只有班级的教师才能获取班级的教师列表
  @Get(':id/teachers')
  async getClassTeachers(@Param('id', ParseIntPipe) id: number) {
    return this.classService.getClassTeachers(id);
  }
  // 从班级移除学生
  // 只有班级的教师才能移除学生
  // 只有班级的学生才能移除自己
  @Delete(':classId/students/:studentId')
  async removeStudent(
    @Param('classId', ParseIntPipe) classId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @CurrentUser() user: any,
  ) {
    return this.classService.removeStudent(classId, studentId, user.id);
  }

  @Post(':classId/monitor/:studentId')
  async setMonitor(
    @Param('classId', ParseIntPipe) classId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
    @CurrentUser() user: any,
  ) {
    return this.classService.setMonitor(classId, studentId, user.id);
  }

  /**
   * 删除班级（级联删除所有关联数据）
   * DELETE /class/:id
   *
   * 只有创建班级的教师才能删除。
   * 删除时会级联清理：
   * - 所有作业的提交记录
   * - 所有作业的题目
   * - 所有作业
   * - 所有学生/教师关系
   *
   * ⚠️ 此操作不可逆！删除后数据无法恢复
   */
  @Delete(':id')
  async deleteClass(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.classService.deleteClass(id, user.id);
  }
}
