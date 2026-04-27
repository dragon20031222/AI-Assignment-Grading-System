import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentService } from './assignment.service';
import { AssignmentController } from './assignment.controller';
import { Assignment } from './entities/assignment.entity';
import { AssignmentSubmit } from './entities/assignment-submit.entity';
import { Question } from './entities/question.entity';
import { ClassStudent } from '../class/entities/class-student.entity';
import { ClassTeacher } from '../class/entities/class-teacher.entity';
import { User } from '../user/entities/user.entity';
import { GradingModule } from '../grading/grading.module';
import { UploadModule } from '../upload/upload.module';

/**
 * 作业模块
 * 整合作业相关的所有功能
 *
 * 包含：
 * - 作业管理（创建、删除、查询）
 * - 题目管理
 * - 作业提交与批改
 * - AI批改服务
 * - 文件上传与查重
 */
@Module({
  imports: [
    // 导入所需的实体，以便Service中使用Repository
    TypeOrmModule.forFeature([
      Assignment, // 作业实体
      AssignmentSubmit, // 提交实体
      Question, // 题目实体
      ClassStudent, // 班级学生关系（用于验证学生归属）
      ClassTeacher, // 班级教师关系（用于验证教师归属）
      User, // 用户实体（用于验证角色）
    ]),
    // 导入AI批改模块
    GradingModule,
    // 导入文件上传与查重模块
    UploadModule,
  ],
  controllers: [AssignmentController], // 注册控制器
  providers: [AssignmentService], // 注册服务
  exports: [AssignmentService], // 导出服务供其他模块使用
})
export class AssignmentModule {}
