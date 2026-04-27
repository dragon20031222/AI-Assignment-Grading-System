import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassInfo } from './entities/class-info.entity';
import { ClassStudent } from './entities/class-student.entity';
import { ClassTeacher } from './entities/class-teacher.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { JoinClassDto } from './dto/join-class.dto';
import { User, UserRole } from '../user/entities/user.entity';

@Injectable()
export class ClassService {
  constructor(
    @InjectRepository(ClassInfo)
    private classInfoRepository: Repository<ClassInfo>,
    @InjectRepository(ClassStudent)
    private classStudentRepository: Repository<ClassStudent>,
    @InjectRepository(ClassTeacher)
    private classTeacherRepository: Repository<ClassTeacher>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
  // 创建班级
  async createClass(
    createClassDto: CreateClassDto,
    teacherId: number,
  ): Promise<ClassInfo> {
    const teacher = await this.userRepository.findOne({
      where: { id: teacherId },
    });

    if (!teacher || teacher.role !== UserRole.TEACHER) {
      throw new ForbiddenException('只有教师才能创建班级');
    }

    let inviteCode: string;
    let codeExists = true;
    while (codeExists) {
      inviteCode = this.generateInviteCode();
      const existing = await this.classInfoRepository.findOne({
        where: { invite_code: inviteCode },
      });
      codeExists = !!existing;
    }

    const classInfo = this.classInfoRepository.create({
      name: createClassDto.name,
      description: createClassDto.description,
      invite_code: inviteCode,
      creator_id: teacherId,
    });

    const savedClass = await this.classInfoRepository.save(classInfo);

    const classTeacher = this.classTeacherRepository.create({
      class_id: savedClass.id,
      teacher_id: teacherId,
      is_main_teacher: true,
    });
    await this.classTeacherRepository.save(classTeacher);

    return savedClass;
  }

  async joinClass(
    joinClassDto: JoinClassDto,
    studentId: number,
  ): Promise<ClassStudent> {
    const student = await this.userRepository.findOne({
      where: { id: studentId },
    });

    if (!student || student.role !== UserRole.STUDENT) {
      throw new ForbiddenException('只有学生才能加入班级');
    }

    const classInfo = await this.classInfoRepository.findOne({
      where: { invite_code: joinClassDto.invite_code },
    });

    if (!classInfo) {
      throw new NotFoundException('班级不存在或邀请码错误');
    }

    const existingMembership = await this.classStudentRepository.findOne({
      where: {
        class_id: classInfo.id,
        student_id: studentId,
      },
    });

    if (existingMembership) {
      throw new ConflictException('你已经加入过这个班级了');
    }

    const classStudent = this.classStudentRepository.create({
      class_id: classInfo.id,
      student_id: studentId,
      is_monitor: false,
    });

    return this.classStudentRepository.save(classStudent);
  }

  async getClassById(classId: number): Promise<ClassInfo> {
    const classInfo = await this.classInfoRepository.findOne({
      where: { id: classId },
      relations: ['creator'],
    });

    if (!classInfo) {
      throw new NotFoundException('班级不存在');
    }

    return classInfo;
  }
  // 获取教师的班级列表
  async getTeacherClasses(teacherId: number): Promise<any[]> {
    const teacherClasses = await this.classTeacherRepository.find({
      where: { teacher_id: teacherId },
      relations: ['class_info', 'class_info.creator'],
    });

    const classesWithCount = await Promise.all(
      teacherClasses.map(async (ct) => {
        const studentCount = await this.classStudentRepository.count({
          where: { class_id: ct.class_info.id },
        });
        return {
          id: ct.class_info.id,
          name: ct.class_info.name,
          description: ct.class_info.description,
          invite_code: ct.class_info.invite_code,
          creator_id: ct.class_info.creator_id,
          creator: ct.class_info.creator,
          created_at: ct.class_info.created_at,
          student_count: studentCount,
        };
      }),
    );

    return classesWithCount;
  }
  // 获取学生的班级列表
  async getStudentClasses(studentId: number): Promise<any[]> {
    const studentClasses = await this.classStudentRepository.find({
      where: { student_id: studentId },
      relations: ['class_info', 'class_info.creator'],
    });

    const classesWithCount = await Promise.all(
      studentClasses.map(async (cs) => {
        const studentCount = await this.classStudentRepository.count({
          where: { class_id: cs.class_info.id },
        });
        return {
          id: cs.class_info.id,
          name: cs.class_info.name,
          description: cs.class_info.description,
          invite_code: cs.class_info.invite_code,
          creator_id: cs.class_info.creator_id,
          creator: cs.class_info.creator,
          created_at: cs.class_info.created_at,
          student_count: studentCount,
          is_monitor: cs.is_monitor,
          joined_at: cs.joined_at,
        };
      }),
    );

    return classesWithCount;
  }
  // 获取班级的学生列表
  async getClassStudents(classId: number): Promise<ClassStudent[]> {
    return this.classStudentRepository.find({
      where: { class_id: classId },
      relations: ['student'],
    });
  }
  // 获取班级的教师列表
  async getClassTeachers(classId: number): Promise<ClassTeacher[]> {
    return this.classTeacherRepository.find({
      where: { class_id: classId },
      relations: ['teacher'],
    });
  }
  // 移除班级的学生
  async removeStudent(
    classId: number,
    studentId: number,
    operatorId: number,
  ): Promise<void> {
    const operator = await this.userRepository.findOne({
      where: { id: operatorId },
    });

    if (!operator || operator.role !== UserRole.TEACHER) {
      throw new ForbiddenException('只有教师才能移除学生');
    }

    const membership = await this.classStudentRepository.findOne({
      where: {
        class_id: classId,
        student_id: studentId,
      },
    });

    if (!membership) {
      throw new NotFoundException('该学生不在此班级中');
    }

    await this.classStudentRepository.remove(membership);
  }
  // 设置班级的班长
  // 只有教师才能设置班长
  // 只有未设置班长的学生才能被设置为班长
  async setMonitor(
    classId: number,
    studentId: number,
    operatorId: number,
  ): Promise<ClassStudent> {
    const operator = await this.userRepository.findOne({
      where: { id: operatorId },
    });

    if (!operator || operator.role !== UserRole.TEACHER) {
      throw new ForbiddenException('只有教师才能设置班长');
    }

    await this.classStudentRepository.update(
      { class_id: classId },
      { is_monitor: false },
    );

    const membership = await this.classStudentRepository.findOne({
      where: {
        class_id: classId,
        student_id: studentId,
      },
    });

    if (!membership) {
      throw new NotFoundException('该学生不在此班级中');
    }

    membership.is_monitor = true;
    return this.classStudentRepository.save(membership);
  }
}
