import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassService } from './class.service';
import { ClassController } from './class.controller';
import { ClassInfo } from './entities/class-info.entity';
import { ClassStudent } from './entities/class-student.entity';
import { ClassTeacher } from './entities/class-teacher.entity';
import { User } from '../user/entities/user.entity';
import { Assignment } from '../assignment/entities/assignment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClassInfo,
      ClassStudent,
      ClassTeacher,
      User,
      Assignment,
    ]),
  ],
  controllers: [ClassController],
  providers: [ClassService],
  exports: [ClassService],
})
export class ClassModule {}
