import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassService } from './class.service';
import { ClassController } from './class.controller';
import { ClassInfo } from './entities/class-info.entity';
import { ClassStudent } from './entities/class-student.entity';
import { ClassTeacher } from './entities/class-teacher.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClassInfo, ClassStudent, ClassTeacher, User]),
  ],
  controllers: [ClassController],
  providers: [ClassService],
  exports: [ClassService],
})
export class ClassModule {}
