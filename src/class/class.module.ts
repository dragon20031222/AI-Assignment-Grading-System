import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassService } from './class.service';
import { ClassController } from './class.controller';
import { ClassInfo } from './entities/class-info.entity';
import { ClassStudent } from './entities/class-student.entity';
import { ClassTeacher } from './entities/class-teacher.entity';
import { User } from '../user/entities/user.entity';
import { Assignment } from '../assignment/entities/assignment.entity';
import { AssignmentSubmit } from '../assignment/entities/assignment-submit.entity';
import { Question } from '../assignment/entities/question.entity';

/**
 * 班级模块
 *
 * 提供班级管理相关功能：
 * - 创建/删除班级
 * - 学生加入班级
 * - 成员管理（移除学生、设置班长）
 *
 * 删除班级时会级联删除所有关联数据
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClassInfo,
      ClassStudent,
      ClassTeacher,
      User,
      Assignment,
      AssignmentSubmit,
      Question,
    ]),
  ],
  controllers: [ClassController],
  providers: [ClassService],
  exports: [ClassService],
})
export class ClassModule {}
