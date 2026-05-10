import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ClassInfo } from './entities/class-info.entity';
import { ClassStudent } from './entities/class-student.entity';
import { ClassTeacher } from './entities/class-teacher.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { JoinClassDto } from './dto/join-class.dto';
import { User, UserRole } from '../user/entities/user.entity';
import { Assignment } from '../assignment/entities/assignment.entity';
import { AssignmentSubmit } from '../assignment/entities/assignment-submit.entity';
import { Question } from '../assignment/entities/question.entity';

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
    @InjectRepository(Assignment)
    private assignmentRepository: Repository<Assignment>,
    @InjectRepository(AssignmentSubmit)
    private submitRepository: Repository<AssignmentSubmit>,
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
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
        const assignmentCount = await this.assignmentRepository.count({
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
          assignment_count: assignmentCount,
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

  /**
   * 删除班级（级联删除所有关联数据）
   *
   * 只有班级的创建者（教师）才能删除班级。
   * 删除时会级联清理以下数据：
   * - 该班级下所有作业的提交记录
   * - 该班级下所有作业的题目
   * - 该班级下的所有作业
   * - 班级-学生关联关系
   * - 班级-教师关联关系
   * - 班级本身
   *
   * 级联删除顺序遵循外键约束原则：先删子表，再删父表
   *
   * @param classId - 班级ID
   * @param operatorId - 操作者ID（当前登录用户的ID）
   *
   * 设计思路（级联删除为什么不用 cascade？）：
   * 1. TypeORM 的 cascade: true 只在调用 .remove() 时生效，且需要先加载所有关联实体到内存
   * 2. 对于批量数据（如一个班级可能有数百条提交），加载到内存效率低
   * 3. 使用 Repository.delete() 直接发 DELETE SQL，性能更好，原子性由数据库事务保证
   */
  async deleteClass(
    classId: number,
    operatorId: number,
  ): Promise<{ message: string }> {
    // 1. 权限验证：只有创建班级的教师才能删除
    const operator = await this.userRepository.findOne({
      where: { id: operatorId },
    });

    if (!operator || operator.role !== UserRole.TEACHER) {
      throw new ForbiddenException('只有教师才能删除班级');
    }

    // 2. 验证班级存在
    const classInfo = await this.classInfoRepository.findOne({
      where: { id: classId },
    });

    if (!classInfo) {
      throw new NotFoundException('班级不存在');
    }

    // 3. 只允许创建者删除
    if (classInfo.creator_id !== operatorId) {
      throw new ForbiddenException('只有班级创建者才能删除班级');
    }

    // 4. 查找该班级下的所有作业ID
    const assignments = await this.assignmentRepository.find({
      where: { class_id: classId },
      select: ['id'],
    });
    const assignmentIds = assignments.map((a) => a.id);

    /*
     * 5. 级联删除（从子到父的顺序）
     *
     * 删除顺序很重要：
     * assignment_submit → question → assignment → class_student → class_teacher → class_info
     *
     * 原因：外键约束决定了必须先删除引用方（子表），再删除被引用方（父表）
     */
    if (assignmentIds.length > 0) {
      // 5a. 删除所有提交记录 (assignment_submit)
      await this.submitRepository.delete({
        assignment_id: In(assignmentIds),
      });

      // 5b. 删除所有题目 (question)
      await this.questionRepository.delete({
        assignment_id: In(assignmentIds),
      });
    }

    // 5c. 删除所有作业 (assignment)
    // 用 class_id 直接批量删除，比逐条删除更高效
    await this.assignmentRepository.delete({ class_id: classId });

    // 5d. 删除班级-学生关联 (class_student)
    await this.classStudentRepository.delete({ class_id: classId });

    // 5e. 删除班级-教师关联 (class_teacher)
    await this.classTeacherRepository.delete({ class_id: classId });

    // 5f. 删除班级本身 (class_info)
    await this.classInfoRepository.delete(classId);

    return { message: `班级"${classInfo.name}"已成功删除` };
  }
}
