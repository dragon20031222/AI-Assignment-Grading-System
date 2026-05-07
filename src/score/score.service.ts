import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AssignmentSubmit } from '../assignment/entities/assignment-submit.entity';
import { Assignment } from '../assignment/entities/assignment.entity';
import { ClassStudent } from '../class/entities/class-student.entity';
import { ClassTeacher } from '../class/entities/class-teacher.entity';
import { User, UserRole } from '../user/entities/user.entity';
import { SubmitStatus } from '../assignment/entities/assignment-type.enum';
import {
  AssignmentGradeSummary,
  StudentGradeInfo,
  ClassGradeStats,
  AssignmentGradeDetail,
  StudentGradeCard,
} from './dto/score.dto';

/**
 * 成绩管理服务
 * 处理所有与成绩查看、统计相关的业务逻辑
 *
 * 核心功能：
 * 1. 老师查看已发布作业的成绩统计（卡片列表）
 * 2. 老师查看某个作业的所有学生成绩详情
 * 3. 学生查看自己的成绩列表
 */
@Injectable()
export class ScoreService {
  constructor(
    /** 作业Repository - 用于查询作业信息 */
    @InjectRepository(Assignment)
    private assignmentRepository: Repository<Assignment>,
    /** 提交Repository - 用于查询提交记录和成绩 */
    @InjectRepository(AssignmentSubmit)
    private submitRepository: Repository<AssignmentSubmit>,
    /** 班级学生Repository - 用于查询学生信息和班级人数 */
    @InjectRepository(ClassStudent)
    private classStudentRepository: Repository<ClassStudent>,
    /** 班级教师Repository - 用于验证教师的班级权限 */
    @InjectRepository(ClassTeacher)
    private classTeacherRepository: Repository<ClassTeacher>,
    /** 用户Repository - 用于查询用户信息 */
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * 获取教师的作业成绩列表（卡片展示用）
   * 返回当前教师创建的所有作业的成绩统计信息
   *
   * @param teacherId - 当前登录教师的ID
   * @returns 作业列表，包含已提交人数、未提交人数、班级平均分等统计信息
   *
   * 业务逻辑：
   * 1. 验证用户是教师角色
   * 2. 获取该教师创建的所有作业
   * 3. 对每个作业统计：已提交人数、班级总人数、平均分
   */
  async getTeacherAssignmentGrades(
    teacherId: number,
  ): Promise<AssignmentGradeSummary[]> {
    // 1. 验证用户是教师
    const teacher = await this.userRepository.findOne({
      where: { id: teacherId },
    });

    if (!teacher || teacher.role !== UserRole.TEACHER) {
      throw new ForbiddenException('只有教师才能查看作业成绩');
    }

    // 2. 获取该教师创建的所有作业
    const assignments = await this.assignmentRepository.find({
      where: { creator_id: teacherId },
      relations: ['class_info'],
      order: { created_at: 'DESC' },
    });

    if (assignments.length === 0) {
      return [];
    }

    // 3. 统计每个作业的提交和成绩情况
    const gradeSummaries = await Promise.all(
      assignments.map(async (assignment) => {
        // 获取班级总人数
        const classStudentCount = await this.classStudentRepository.count({
          where: { class_id: assignment.class_id },
        });

        // 获取已提交人数
        const submittedCount = await this.submitRepository.count({
          where: { assignment_id: assignment.id },
        });

        // 获取班级平均分（只统计已批改的）
        const avgScoreResult = await this.submitRepository
          .createQueryBuilder('submit')
          .select('AVG(submit.score)', 'avg_score')
          .where('submit.assignment_id = :assignmentId', {
            assignmentId: assignment.id,
          })
          .andWhere('submit.status = :status', {
            status: SubmitStatus.COMPLETED,
          })
          .getRawOne();

        return {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          type: assignment.type,
          class_id: assignment.class_id,
          class_name: assignment.class_info?.name,
          submitted_count: submittedCount,
          not_submitted_count: classStudentCount - submittedCount,
          class_total_count: classStudentCount,
          class_average_score: avgScoreResult?.avg_score
            ? parseFloat(parseFloat(avgScoreResult.avg_score).toFixed(2))
            : null,
          created_at: assignment.created_at,
          deadline: assignment.deadline,
        };
      }),
    );

    return gradeSummaries;
  }

  /**
   * 获取作业的学生成绩详情
   * 返回指定作业的所有学生的成绩信息，包括排名
   *
   * @param assignmentId - 作业ID
   * @param teacherId - 当前登录教师的ID
   * @returns 作业成绩详情，包含班级统计和学生列表
   *
   * 业务逻辑：
   * 1. 验证用户是教师
   * 2. 验证作业存在且属于该教师
   * 3. 获取班级总人数
   * 4. 获取所有提交记录并计算班级统计（平均分、最高分、最低分）
   * 5. 计算每个学生的排名
   */
  async getAssignmentGradeDetail(
    assignmentId: number,
    teacherId: number,
  ): Promise<AssignmentGradeDetail> {
    // 1. 验证用户是教师
    const teacher = await this.userRepository.findOne({
      where: { id: teacherId },
    });

    if (!teacher || teacher.role !== UserRole.TEACHER) {
      throw new ForbiddenException('只有教师才能查看作业成绩详情');
    }

    // 2. 验证作业存在且属于该教师
    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['class_info'],
    });

    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }

    if (assignment.creator_id !== teacherId) {
      throw new ForbiddenException('你只能查看自己布置的作业的成绩');
    }

    // 3. 获取班级总人数
    const classStudentCount = await this.classStudentRepository.count({
      where: { class_id: assignment.class_id },
    });

    // 4. 获取所有提交记录
    const submits = await this.submitRepository.find({
      where: { assignment_id: assignmentId },
      relations: ['student'],
      order: { submitted_at: 'DESC' },
    });

    // 5. 计算班级统计信息
    // 只统计已批改的提交
    const gradedSubmits = submits.filter(
      (s) => s.status === SubmitStatus.COMPLETED && s.score !== null,
    );

    let averageScore: number | null = null;
    let highestScore: number | null = null;
    let lowestScore: number | null = null;

    if (gradedSubmits.length > 0) {
      const scores = gradedSubmits.map((s) => s.score as number);
      const sum = scores.reduce((acc, score) => acc + score, 0);
      averageScore = parseFloat((sum / scores.length).toFixed(2));
      highestScore = Math.max(...scores);
      lowestScore = Math.min(...scores);
    }

    // 6. 构建学生成绩列表并计算排名
    // 先按分数降序排序，计算排名（并列处理）
    const scoredSubmits = gradedSubmits
      .map((s) => ({
        student_id: s.student_id,
        student_name: s.student?.name || '未知',
        student_username: s.student?.username || '未知',
        score: s.score,
        comment: s.comment,
        status: s.status,
        submitted_at: s.submitted_at,
        graded_at: s.graded_at,
      }))
      .sort((a, b) => (b.score as number) - (a.score as number));

    // 计算排名（并列处理：例如 1, 1, 3）
    let currentRank = 1;
    let previousScore: number | null = null;

    const studentsWithRank = scoredSubmits.map((s, index) => {
      if (previousScore !== null && s.score !== previousScore) {
        currentRank = index + 1;
      }
      previousScore = s.score;
      return {
        ...s,
        rank: currentRank,
      };
    });

    // 添加未提交的学生（排在最后）
    const submittedStudentIds = new Set(submits.map((s) => s.student_id));
    const notSubmittedStudents = await this.classStudentRepository.find({
      where: { class_id: assignment.class_id },
      relations: ['student'],
    });

    const notSubmitted = notSubmittedStudents
      .filter((cs) => !submittedStudentIds.has(cs.student_id))
      .map((cs) => ({
        student_id: cs.student_id,
        student_name: cs.student?.name || '未知',
        student_username: cs.student?.username || '未知',
        score: null,
        comment: null,
        status: null,
        submitted_at: null,
        graded_at: null,
        rank: null,
      }));

    const allStudents = [...studentsWithRank, ...notSubmitted];

    // 7. 组装返回数据
    return {
      assignment_info: {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        type: assignment.type,
        class_id: assignment.class_id,
        class_name: assignment.class_info?.name,
        created_at: assignment.created_at,
        deadline: assignment.deadline,
      },
      class_stats: {
        total_count: classStudentCount,
        submitted_count: submits.length,
        not_submitted_count: classStudentCount - submits.length,
        graded_count: gradedSubmits.length,
        average_score: averageScore,
        highest_score: highestScore,
        lowest_score: lowestScore,
      },
      students: allStudents,
    };
  }

  /**
   * 获取学生的成绩列表（卡片展示用）
   * 返回学生所在所有班级的作业成绩信息
   *
   * @param studentId - 当前登录学生的ID
   * @returns 成绩列表，包含我的分数、班级平均分、班级排名等
   *
   * 业务逻辑：
   * 1. 验证用户是学生角色
   * 2. 获取学生所在的所有班级
   * 3. 获取这些班级的所有作业
   * 4. 获取学生对这些作业的提交情况
   * 5. 计算每个作业的班级平均分
   * 6. 计算学生在每个作业中的排名
   */
  async getStudentGrades(studentId: number): Promise<StudentGradeCard[]> {
    // 1. 验证用户是学生
    const student = await this.userRepository.findOne({
      where: { id: studentId },
    });

    if (!student || student.role !== UserRole.STUDENT) {
      throw new ForbiddenException('只有学生才能查看成绩');
    }

    // 2. 获取学生所在的所有班级
    const studentClasses = await this.classStudentRepository.find({
      where: { student_id: studentId },
    });

    if (studentClasses.length === 0) {
      return [];
    }

    const classIds = studentClasses.map((sc) => sc.class_id);

    // 3. 获取这些班级的所有作业
    const assignments = await this.assignmentRepository.find({
      where: { class_id: In(classIds) },
      relations: ['class_info'],
      order: { deadline: 'ASC' },
    });

    if (assignments.length === 0) {
      return [];
    }

    // 4. 获取学生对这些作业的提交情况
    const studentSubmits = await this.submitRepository.find({
      where: {
        student_id: studentId,
        assignment_id: In(assignments.map((a) => a.id)),
      },
    });

    const submitMap = new Map(studentSubmits.map((s) => [s.assignment_id, s]));

    // 5. 获取所有作业的班级平均分
    const assignmentIds = assignments.map((a) => a.id);
    const avgScoreResults = await this.submitRepository
      .createQueryBuilder('submit')
      .select('submit.assignment_id', 'assignment_id')
      .addSelect('AVG(submit.score)', 'avg_score')
      .where('submit.assignment_id IN (:...ids)', { ids: assignmentIds })
      .andWhere('submit.status = :status', { status: SubmitStatus.COMPLETED })
      .groupBy('submit.assignment_id')
      .getRawMany();

    const avgScoreMap = new Map(
      avgScoreResults.map((r) => [
        r.assignment_id,
        parseFloat(parseFloat(r.avg_score).toFixed(2)),
      ]),
    );

    // 6. 获取每个作业的学生分数排名
    const rankResults = await this.submitRepository
      .createQueryBuilder('submit')
      .select('submit.assignment_id', 'assignment_id')
      .addSelect('submit.student_id', 'student_id')
      .addSelect('submit.score', 'score')
      .where('submit.assignment_id IN (:...ids)', { ids: assignmentIds })
      .andWhere('submit.status = :status', { status: SubmitStatus.COMPLETED })
      .orderBy('submit.score', 'DESC')
      .getRawMany();

    // 计算每个作业中学生分数的排名
    const studentRanksMap = new Map<number, Map<number, number>>();
    for (const assignmentId of assignmentIds) {
      const assignmentScores = rankResults
        .filter((r) => r.assignment_id === assignmentId)
        .sort((a, b) => (b.score as number) - (a.score as number));

      const studentIdToRank = new Map<number, number>();
      let currentRank = 1;
      let previousScore: number | null = null;

      assignmentScores.forEach((r, index) => {
        if (previousScore !== null && r.score !== previousScore) {
          currentRank = index + 1;
        }
        previousScore = r.score;
        studentIdToRank.set(r.student_id, currentRank);
      });

      studentRanksMap.set(assignmentId, studentIdToRank);
    }

    // 7. 组装返回数据
    const now = new Date();
    return assignments.map((a) => {
      const submit = submitMap.get(a.id);
      const avgScore = avgScoreMap.get(a.id) || null;
      const studentRankMap = studentRanksMap.get(a.id);
      const myRank =
        submit?.score !== null && submit?.score !== undefined
          ? studentRankMap?.get(studentId) || null
          : null;

      return {
        id: a.id,
        title: a.title,
        class_name: a.class_info?.name,
        my_score: submit?.score || null,
        class_average_score: avgScore,
        class_rank: myRank,
        submit_status: submit?.status || null,
        is_overdue: new Date(a.deadline) < now,
        created_at: a.created_at,
        deadline: a.deadline,
      };
    });
  }
}
