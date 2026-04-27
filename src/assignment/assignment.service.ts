import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { REQUEST } from '@nestjs/core';
import { Assignment } from './entities/assignment.entity';
import { AssignmentSubmit } from './entities/assignment-submit.entity';
import { Question } from './entities/question.entity';
import { ClassStudent } from '../class/entities/class-student.entity';
import { ClassTeacher } from '../class/entities/class-teacher.entity';
import { User, UserRole } from '../user/entities/user.entity';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { SubmitStatus } from './entities/assignment-type.enum';
import { GradingService } from '../grading/grading.service';
import { DuplicateCheckService } from '../upload/duplicate-check.service';

/**
 * 作业服务
 * 处理所有与作业相关的业务逻辑
 */
@Injectable()
export class AssignmentService {
  /**
   * 构造函数 - 注入所需的 Repository
   */
  constructor(
    /** 作业Repository - 用于操作作业表 */
    @InjectRepository(Assignment)
    private assignmentRepository: Repository<Assignment>,
    /** 提交Repository - 用于操作作业提交表 */
    @InjectRepository(AssignmentSubmit)
    private submitRepository: Repository<AssignmentSubmit>,
    /** 题目Repository - 用于操作题目表 */
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    /** 班级学生Repository - 用于查询学生的班级信息 */
    @InjectRepository(ClassStudent)
    private classStudentRepository: Repository<ClassStudent>,
    /** 班级教师Repository - 用于查询教师的班级信息 */
    @InjectRepository(ClassTeacher)
    private classTeacherRepository: Repository<ClassTeacher>,
    /** 用户Repository - 用于查询用户信息 */
    @InjectRepository(User)
    private userRepository: Repository<User>,
    /** AI批改服务 - 用于调用AI进行作业批改 */
    private readonly gradingService: GradingService,
    /** 图片查重服务 - 用于检查作业图片是否重复 */
    private readonly duplicateCheckService: DuplicateCheckService,
    @Optional()
    @Inject(REQUEST)
    private readonly request: any,
  ) {}

  /**
   * 创建作业
   * 教师在某个班级创建新作业
   *
   * @param createDto - 创建作业的数据传输对象，包含作业信息和题目列表
   * @param teacherId - 当前登录教师的ID（从JWT token中获取）
   * @returns 创建的作业对象
   *
   * 业务逻辑：
   * 1. 验证当前用户是否是教师
   * 2. 验证教师是否在该班级中（只有班级教师才能创建作业）
   * 3. 创建作业记录
   * 4. 如果有题目，创建题目记录
   */
  async createAssignment(
    createDto: CreateAssignmentDto,
    teacherId: number,
  ): Promise<Assignment> {
    // 1. 查找教师用户并验证角色
    const teacher = await this.userRepository.findOne({
      where: { id: teacherId },
    });

    if (!teacher || teacher.role !== UserRole.TEACHER) {
      throw new ForbiddenException('只有教师才能创建作业');
    }

    // 2. 验证教师是否在该班级中
    const isTeacherInClass = await this.classTeacherRepository.findOne({
      where: {
        class_id: createDto.class_id,
        teacher_id: teacherId,
      },
    });

    if (!isTeacherInClass) {
      throw new ForbiddenException('你不在这个班级中，无权创建作业');
    }

    // 3. 创建作业记录
    const assignment = this.assignmentRepository.create({
      title: createDto.title,
      description: createDto.description,
      type: createDto.type,
      check_duplicate: createDto.check_duplicate ?? true,
      grading_criteria: createDto.grading_criteria,
      deadline: new Date(createDto.deadline),
      class_id: createDto.class_id,
      creator_id: teacherId,
    });

    // 保存到数据库
    const savedAssignment = await this.assignmentRepository.save(assignment);

    // 4. 如果有题目，创建题目记录
    if (createDto.questions && createDto.questions.length > 0) {
      const questions = createDto.questions.map((q, index) =>
        this.questionRepository.create({
          assignment_id: savedAssignment.id,
          type: q.type,
          description: q.description,
          options: q.options,
          correct_answer: q.correct_answer,
          score: q.score ?? 10, // 默认10分
          order: q.order ?? index + 1, // 默认按数组顺序
        }),
      );
      await this.questionRepository.save(questions);
    }

    return savedAssignment;
  }

  /**
   * 获取教师的作业列表
   * 返回当前教师创建的所有作业，包含每个作业的提交人数
   *
   * @param teacherId - 当前登录教师的ID
   * @returns 作业列表，每个作业包含提交人数
   */
  async getTeacherAssignments(teacherId: number): Promise<any[]> {
    // 查找该教师创建的所有作业
    const assignments = await this.assignmentRepository.find({
      where: { creator_id: teacherId },
      relations: ['class_info', 'creator'], // 预加载班级和创建者信息
      order: { created_at: 'DESC' }, // 按创建时间倒序
    });

    // 为每个作业计算提交人数
    const assignmentsWithSubmitCount = await Promise.all(
      assignments.map(async (a) => {
        // 统计有多少学生提交了这个作业
        const submitCount = await this.submitRepository.count({
          where: { assignment_id: a.id },
        });
        return {
          id: a.id,
          title: a.title,
          description: a.description,
          type: a.type,
          check_duplicate: a.check_duplicate,
          deadline: a.deadline,
          class_id: a.class_id,
          class_name: a.class_info?.name,
          creator_id: a.creator_id,
          creator_name: a.creator?.name,
          created_at: a.created_at,
          submit_count: submitCount,
        };
      }),
    );

    return assignmentsWithSubmitCount;
  }

  /**
   * 获取学生的作业列表
   * 返回学生所在所有班级的作业，按截止时间排序
   *
   * @param studentId - 当前登录学生的ID
   * @returns 作业列表，包含是否已提交、是否过期等信息
   */
  async getStudentAssignments(studentId: number): Promise<any[]> {
    // 1. 获取学生所在的所有班级
    const studentClasses = await this.classStudentRepository.find({
      where: { student_id: studentId },
    });

    // 如果学生没有加入任何班级，返回空数组
    if (studentClasses.length === 0) {
      return [];
    }

    // 提取班级ID列表
    const classIds = studentClasses.map((sc) => sc.class_id);

    // 2. 获取这些班级的所有作业
    const assignments = await this.assignmentRepository.find({
      where: { class_id: In(classIds) },
      relations: ['class_info', 'creator'],
      order: { deadline: 'ASC' }, // 按截止时间正序
    });

    // 3. 获取该学生对这些作业的提交情况
    const studentSubmits = await this.submitRepository.find({
      where: {
        student_id: studentId,
        assignment_id: In(assignments.map((a) => a.id)),
      },
    });

    // 4. 统计每个作业的提交人数
    const submitCounts = await this.submitRepository
      .createQueryBuilder('submit')
      .select('submit.assignment_id', 'assignment_id')
      .addSelect('COUNT(*)', 'count')
      .where('submit.assignment_id IN (:...ids)', { ids: assignments.map((a) => a.id) })
      .groupBy('submit.assignment_id')
      .getRawMany();

    const submitCountMap = new Map(submitCounts.map((s) => [s.assignment_id, parseInt(s.count)]));
    const submitMap = new Map(studentSubmits.map((s) => [s.assignment_id, s]));

    const now = new Date();

    // 5. 组装返回数据
    return assignments.map((a) => {
      const submit = submitMap.get(a.id);
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        type: a.type,
        deadline: a.deadline,
        class_id: a.class_id,
        class_name: a.class_info?.name,
        creator_name: a.creator?.name,
        created_at: a.created_at,
        is_overdue: new Date(a.deadline) < now, // 是否已过期
        submit_status: submit?.status || null, // 提交状态
        submit_id: submit?.id || null, // 提交记录ID
        submit_count: submitCountMap.get(a.id) || 0, // 已提交人数
        score: submit?.score || null, // 得分
      };
    });
  }

  /**
   * 获取作业详情
   * 返回作业的完整信息，包括题目列表
   *
   * @param assignmentId - 作业ID
   * @param studentId - 可选，学生ID（如果传入则同时返回该学生的提交情况）
   * @returns 作业详情
   */
  async getAssignmentDetail(
    assignmentId: number,
    studentId?: number,
  ): Promise<any> {
    // 查找作业
    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['class_info', 'creator'],
    });

    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }

    // 查找题目（按顺序排列）
    const questions = await this.questionRepository.find({
      where: { assignment_id: assignmentId },
      order: { order: 'ASC' },
    });

    // 转换题目格式，包含正确答案（前端需要判断学生答案对错）
    const questionsWithAnswer = questions.map((q) => ({
      id: q.id,
      type: q.type,
      description: q.description,
      options: q.options,
      correct_answer: q.correct_answer,
      score: q.score,
      order: q.order,
    }));

    // 如果传入了学生ID，查找该学生的提交情况
    let submit = null;
    if (studentId) {
      submit = await this.submitRepository.findOne({
        where: {
          assignment_id: assignmentId,
          student_id: studentId,
        },
      });
    }

    // 统计已提交人数
    const submitCount = await this.submitRepository.count({
      where: { assignment_id: assignmentId },
    });

    // 组装返回数据
    return {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      type: assignment.type,
      check_duplicate: assignment.check_duplicate,
      grading_criteria: assignment.grading_criteria,
      deadline: assignment.deadline,
      class_id: assignment.class_id,
      class_name: assignment.class_info?.name,
      creator_id: assignment.creator_id,
      creator_name: assignment.creator?.name,
      created_at: assignment.created_at,
      submit_count: submitCount,
      questions: questionsWithAnswer,
      // 如果有提交记录，包含进去
      my_submit: submit
        ? {
            id: submit.id,
            answers: this.processAnswersWithImages(submit.answers),
            score: submit.score,
            comment: submit.comment,
            status: submit.status,
            submitted_at: submit.submitted_at,
            graded_at: submit.graded_at,
          }
        : null,
    };
  }

  /**
   * 处理答案中的图片路径，转换为完整的访问URL
   *
   * @param answers - 原始答案对象
   * @returns 处理后的答案对象，图片路径变为完整URL
   *
   * 例如：
   * 输入: { "1": "/uploads/img-xxx.png" }
   * 输出: { "1": "http://localhost:3000/uploads/img-xxx.png" }
   */
  private processAnswersWithImages(answers: object): object {
    const baseUrl = this.getBaseUrl();
    const processed: Record<string, any> = {};

    for (const [key, value] of Object.entries(answers)) {
      if (typeof value === 'string') {
        // 先检查是否是用换行符分隔的多个图片路径
        if (value.includes('\n') && this.containsImagePath(value)) {
          // 分割多个图片路径并处理
          const paths = value.split('\n').filter((p) => p.trim());
          processed[key] = paths.map((path) => {
            const trimmed = path.trim();
            return trimmed.startsWith('/uploads/')
              ? `${baseUrl}${trimmed}`
              : trimmed;
          });
        } else if (value.startsWith('/uploads/')) {
          // 单个图片路径
          processed[key] = `${baseUrl}${value}`;
        } else {
          processed[key] = value;
        }
      } else if (Array.isArray(value)) {
        // 如果是数组，递归处理每个元素
        processed[key] = value.map((item) =>
          typeof item === 'string' && item.startsWith('/uploads/')
            ? `${baseUrl}${item}`
            : item,
        );
      } else {
        processed[key] = value;
      }
    }

    return processed;
  }

  /**
   * 检查字符串是否包含图片路径
   */
  private containsImagePath(str: string): boolean {
    return str.includes('/uploads/');
  }

  /**
   * 获取当前请求的Base URL
   * 用于生成完整的图片访问URL
   *
   * 优先使用环境变量中的公网地址（内网穿透时需要）
   * 如果没有配置，则从请求中获取
   */
  private getBaseUrl(): string {
    // 优先使用配置的公网地址（内网穿透时使用）
    const publicBaseUrl = process.env.PUBLIC_BASE_URL;
    if (publicBaseUrl) {
      return publicBaseUrl;
    }

    if (!this.request) {
      // 如果没有request对象，使用默认值
      return 'http://localhost:3000';
    }

    const protocol = this.request.protocol || 'http';
    const hostname = this.request.hostname || 'localhost';
    const port = this.request.port || '3000';

    // 如果端口是默认端口，可能不需要显式指定
    const showPort = ![80, 443, '80', '443'].includes(port);
    const portStr = showPort ? `:${port}` : '';

    return `${protocol}://${hostname}${portStr}`;
  }

  /**
   * 提交作业
   * 学生提交作业答案，系统自动调用AI进行批改
   *
   * @param submitDto - 提交作业的数据传输对象
   * @param studentId - 当前登录学生的ID
   * @returns 提交记录
   *
   * 业务逻辑：
   * 1. 验证是学生才能提交
   * 2. 验证作业存在
   * 3. 验证作业未截止
   * 4. 验证学生在该班級中
   * 5. 验证未提交过（防止重复提交）
   * 6. 保存提交记录
   * 7. 异步调用AI批改
   */
  async submitAssignment(
    submitDto: SubmitAssignmentDto,
    studentId: number,
  ): Promise<AssignmentSubmit> {
    // 1. 验证是学生
    const student = await this.userRepository.findOne({
      where: { id: studentId },
    });

    if (!student || student.role !== UserRole.STUDENT) {
      throw new ForbiddenException('只有学生才能提交作业');
    }

    // 2. 验证作业存在
    const assignment = await this.assignmentRepository.findOne({
      where: { id: submitDto.assignment_id },
      relations: ['class_info'],
    });

    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }

    // 3. 验证作业未截止
    if (new Date(assignment.deadline) < new Date()) {
      throw new BadRequestException('作业已截止，无法提交');
    }

    // 4. 验证学生在该班級中
    const isInClass = await this.classStudentRepository.findOne({
      where: {
        class_id: assignment.class_id,
        student_id: studentId,
      },
    });

    if (!isInClass) {
      throw new ForbiddenException('你不在这个班级中，无法提交作业');
    }

    // 5. 验证未提交过
    const existingSubmit = await this.submitRepository.findOne({
      where: {
        assignment_id: submitDto.assignment_id,
        student_id: studentId,
      },
    });

    if (existingSubmit) {
      throw new BadRequestException('你已经提交过这个作业了');
    }

    // 6. 保存提交记录
    const submit = this.submitRepository.create({
      assignment_id: submitDto.assignment_id,
      student_id: studentId,
      answers: submitDto.answers,
      status: SubmitStatus.PENDING, // 初始状态为待批改
    });

    const savedSubmit = await this.submitRepository.save(submit);

    // 6.5 如果作业开启了查重，进行图片查重
    if (assignment.check_duplicate) {
      try {
        // 计算提交图片的哈希值
        const imageHashes =
          await this.duplicateCheckService.calculateImageHashes(
            submitDto.answers as Record<string, any>,
          );
        // 更新哈希值
        await this.submitRepository.update(savedSubmit.id, {
          image_hashes: imageHashes,
        });

        // 与其他提交进行查重
        const duplicateResult = await this.duplicateCheckService.checkDuplicate(
          submitDto.assignment_id,
          studentId,
          submitDto.answers as Record<string, any>,
        );

        // 更新查重结果
        await this.submitRepository.update(savedSubmit.id, {
          duplicate_check_result: duplicateResult,
        });

        // 如果发现重复，不继续批改
        if (duplicateResult.isDuplicate) {
          await this.submitRepository.update(savedSubmit.id, {
            status: SubmitStatus.FAILED,
            comment: '作业图片与他人重复，疑似抄袭',
          });
          return savedSubmit;
        }
      } catch (error) {
        console.error('查重失败:', error);
        // 查重失败不影响继续批改
      }
    }

    // 7. 异步调用AI批改（不等待完成）
    this.processGrading(savedSubmit.id, assignment);

    return savedSubmit;
  }

  /**
   * 处理AI批改
   * 这是一个私有方法，被submitAssignment异步调用
   *
   * @param submitId - 提交记录ID
   * @param assignment - 作业对象
   */
  private async processGrading(submitId: number, assignment: Assignment) {
    // 先更新状态为"批改中"
    await this.submitRepository.update(submitId, {
      status: SubmitStatus.GRADING,
    });

    try {
      // 获取题目列表
      const questions = await this.questionRepository.find({
        where: { assignment_id: assignment.id },
        order: { order: 'ASC' },
      });

      // 获取提交记录
      const submit = await this.submitRepository.findOne({
        where: { id: submitId },
      });

      // 处理答案中的图片路径，转换为完整URL供AI识别
      const processedAnswers = this.processAnswersWithImages(submit.answers);

      // 调用AI进行批改
      const gradingResult = await this.gradingService.gradeAssignment({
        assignment_id: assignment.id,
        title: assignment.title,
        description: assignment.description || '',
        type: assignment.type,
        grading_criteria: assignment.grading_criteria || '',
        questions,
        answers: processedAnswers,
      });

      // 根据批改结果更新数据库
      if (gradingResult.success) {
        await this.submitRepository.update(submitId, {
          score: gradingResult.score,
          comment: gradingResult.comment,
          ai_result: JSON.stringify(gradingResult.details), // 存储详细结果
          status: SubmitStatus.COMPLETED, // 标记为已完成
          graded_at: new Date(), // 记录批改时间
        });
      } else {
        await this.submitRepository.update(submitId, {
          ai_result: gradingResult.error,
          status: SubmitStatus.FAILED, // 标记为失败
        });
      }
    } catch (error) {
      // 捕获任何异常，标记为批改失败
      await this.submitRepository.update(submitId, {
        ai_result: error.message,
        status: SubmitStatus.FAILED,
      });
    }
  }

  /**
   * 删除作业
   * 教师删除自己创建的作业，同时删除关联的题目和提交记录
   *
   * @param assignmentId - 要删除的作业ID
   * @param teacherId - 当前登录教师的ID
   */
  async deleteAssignment(assignmentId: number, teacherId: number) {
    // 1. 验证是教师
    const teacher = await this.userRepository.findOne({
      where: { id: teacherId },
    });

    if (!teacher || teacher.role !== UserRole.TEACHER) {
      throw new ForbiddenException('只有教师才能删除作业');
    }

    // 2. 验证作业存在
    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }

    // 3. 验证是创建者（只能删除自己的作业）
    if (assignment.creator_id !== teacherId) {
      throw new ForbiddenException('你只能删除自己创建的作业');
    }

    // 4. 删除关联的题目
    await this.questionRepository.delete({ assignment_id: assignmentId });
    // 5. 删除关联的提交记录
    await this.submitRepository.delete({ assignment_id: assignmentId });
    // 6. 删除作业本身
    await this.assignmentRepository.delete(assignmentId);
  }

  /**
   * 获取作业的提交列表
   * 教师查看某个作业的所有学生提交情况
   *
   * @param assignmentId - 作业ID
   * @param teacherId - 当前登录教师的ID
   * @returns 提交列表，包含学生信息和批改状态
   */
  async getAssignmentSubmits(assignmentId: number, teacherId: number) {
    // 1. 验证是教师
    const teacher = await this.userRepository.findOne({
      where: { id: teacherId },
    });

    if (!teacher || teacher.role !== UserRole.TEACHER) {
      throw new ForbiddenException('只有教师才能查看提交列表');
    }

    // 2. 验证作业存在
    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }

    // 3. 验证是作业创建者
    if (assignment.creator_id !== teacherId) {
      throw new ForbiddenException('你只能查看自己布置的作业的提交情况');
    }

    // 4. 获取所有提交记录
    const submits = await this.submitRepository.find({
      where: { assignment_id: assignmentId },
      relations: ['student'], // 预加载学生信息
      order: { submitted_at: 'DESC' }, // 按提交时间倒序
    });

    // 5. 转换返回格式
    return submits.map((s) => ({
      id: s.id,
      student_id: s.student_id,
      student_name: s.student?.name,
      student_username: s.student?.username,
      answers: s.answers,
      score: s.score,
      comment: s.comment,
      status: s.status,
      submitted_at: s.submitted_at,
      graded_at: s.graded_at,
    }));
  }
}
