import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScoreController } from './score.controller';
import { ScoreService } from './score.service';
import { Assignment } from '../assignment/entities/assignment.entity';
import { AssignmentSubmit } from '../assignment/entities/assignment-submit.entity';
import { ClassStudent } from '../class/entities/class-student.entity';
import { ClassTeacher } from '../class/entities/class-teacher.entity';
import { User } from '../user/entities/user.entity';

/**
 * 成绩管理模块
 * 提供作业成绩查看、统计等相关功能
 *
 * 包含功能：
 * 1. 老师查看已发布作业的成绩统计列表
 * 2. 老师查看某个作业的所有学生成绩详情
 * 3. 学生查看自己的成绩列表
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Assignment,
      AssignmentSubmit,
      ClassStudent,
      ClassTeacher,
      User,
    ]),
  ],
  controllers: [ScoreController],
  providers: [ScoreService],
  exports: [ScoreService],
})
export class ScoreModule {}
