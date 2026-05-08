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

  /**
   * 导出作业成绩为 Excel 文件
   *
   * 生成包含所有学生成绩详情的 Excel 工作簿，包含：
   * 1. 作业基本信息（标题、截止时间、班级）
   * 2. 学生成绩表格（序号、学号、姓名、提交状态、分数、查重结果、提交时间、批改时间、评语）
   * 3. 班级统计汇总（总人数、提交人数、平均分、最高分、最低分）
   *
   * @param assignmentId - 作业ID
   * @param teacherId - 教师ID（用于权限验证）
   * @returns Excel文件的Buffer和文件名
   *
   * 设计思路：
   * 1. 使用 exceljs 库生成 .xlsx 文件，该库支持丰富的单元格样式（颜色、边框、对齐）
   * 2. 表头使用深色背景+白色字体，数据行交替颜色，提高可读性
   * 3. 未提交学生在分数列显示 "-"，与其他学生的数据区分
   * 4. 查重结果自动解析 duplicate_check_result JSON，提取疑似重复数量
   * 5. 底部添加统计行，汇总班级整体情况
   * 6. 返回 Buffer 对象，由 Controller 写入 HTTP Response 流实现文件下载
   */
  async exportAssignmentGradesToExcel(
    assignmentId: number,
    teacherId: number,
  ): Promise<{ buffer: Buffer; filename: string }> {
    // 权限验证与数据获取（复用 getAssignmentGradeDetail 的验证逻辑）
    const teacher = await this.userRepository.findOne({
      where: { id: teacherId },
    });

    if (!teacher || teacher.role !== UserRole.TEACHER) {
      throw new ForbiddenException('只有教师才能导出成绩');
    }

    // 验证作业存在且属于该教师
    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['class_info'],
    });

    if (!assignment) {
      throw new NotFoundException('作业不存在');
    }

    if (assignment.creator_id !== teacherId) {
      throw new ForbiddenException('你只能导出自己布置的作业的成绩');
    }

    // 获取班级总人数
    const classStudentCount = await this.classStudentRepository.count({
      where: { class_id: assignment.class_id },
    });

    // 获取所有提交记录（含学生信息）
    const submits = await this.submitRepository.find({
      where: { assignment_id: assignmentId },
      relations: ['student'],
      order: { submitted_at: 'DESC' },
    });

    // 构建已提交学生ID集合
    const submittedStudentIds = new Set(submits.map((s) => s.student_id));
    const submitMap = new Map(submits.map((s) => [s.student_id, s]));

    // 获取班级全部学生
    const classStudents = await this.classStudentRepository.find({
      where: { class_id: assignment.class_id },
      relations: ['student'],
    });

    // 计算班级统计数据
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

    // ---- 开始构建 Excel ----
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();

    // 设置工作簿属性
    workbook.creator = teacher.name || '教师';
    workbook.created = new Date();

    // 创建工作表
    const worksheet = workbook.addWorksheet(`${assignment.title} 成绩表`);

    /*
     * 定义列结构
     * key 用于 dataRows 绑定，width 是列宽（字符数）
     */
    const columns = [
      { header: '序号', key: 'index', width: 6 },
      { header: '学号', key: 'username', width: 16 },
      { header: '姓名', key: 'name', width: 12 },
      { header: '提交状态', key: 'status', width: 14 },
      { header: '分数', key: 'score', width: 10 },
      { header: '查重结果', key: 'duplicate', width: 16 },
      { header: '提交时间', key: 'submittedAt', width: 20 },
      { header: '批改时间', key: 'gradedAt', width: 20 },
      { header: '评语', key: 'comment', width: 30 },
    ];

    worksheet.columns = columns;

    // ---- 构建数据行 ----
    const dataRows: any[] = [];

    for (let i = 0; i < classStudents.length; i++) {
      const cs = classStudents[i];
      const student = cs.student;
      const submit = submitMap.get(cs.student_id);

      // 提交状态转中文
      let statusText: string;
      if (!submit) {
        statusText = '未提交';
      } else {
        switch (submit.status) {
          case SubmitStatus.PENDING:
            statusText = '待批改';
            break;
          case SubmitStatus.GRADING:
            statusText = '批改中';
            break;
          case SubmitStatus.COMPLETED:
            statusText = '已批改';
            break;
          case SubmitStatus.FAILED:
            statusText = '提交失败';
            break;
          default:
            statusText = '未知';
        }
      }

      // 查重结果解析
      let duplicateText: string;
      if (!submit || !submit.duplicate_check_result) {
        duplicateText = '未查重';
      } else {
        const dupResult = submit.duplicate_check_result as any;
        if (dupResult.isDuplicate && dupResult.duplicates?.length > 0) {
          duplicateText = `疑似重复(${dupResult.duplicates.length}处)`;
        } else {
          duplicateText = '正常';
        }
      }

      // 时间格式化
      const formatTime = (date: Date | null): string => {
        if (!date) return '-';
        const d = new Date(date);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };

      dataRows.push({
        index: i + 1,
        username: student?.username || '-',
        name: student?.name || '未知',
        status: statusText,
        score: submit?.score != null ? submit.score : '-',
        duplicate: duplicateText,
        submittedAt: formatTime(submit?.submitted_at || null),
        gradedAt: formatTime(submit?.graded_at || null),
        comment: submit?.comment || '-',
      });
    }

    // 写入数据行
    dataRows.forEach((row) => {
      worksheet.addRow(row);
    });

    // 空一行后添加统计行
    worksheet.addRow([]);
    worksheet.addRow(['班级统计', '', '', '', '', '', '', '', '']);
    worksheet.addRow(['总人数', classStudentCount, '', '', '', '', '', '', '']);
    worksheet.addRow(['已提交', submits.length, '', '', '', '', '', '', '']);
    worksheet.addRow([
      '未提交',
      classStudentCount - submits.length,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    worksheet.addRow([
      '平均分',
      averageScore != null ? averageScore : '-',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    worksheet.addRow([
      '最高分',
      highestScore != null ? highestScore : '-',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    worksheet.addRow([
      '最低分',
      lowestScore != null ? lowestScore : '-',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);

    // ---- 样式美化 ----
    // 1. 表头样式：深蓝背景 + 白色粗体文字 + 居中对齐
    const headerRow = worksheet.getRow(1);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = {
        name: '微软雅黑',
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 11,
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }, // 深蓝色
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // 2. 数据行样式：交替行背景色 + 居中对齐 + 边框
    for (let i = 2; i <= dataRows.length + 1; i++) {
      const row = worksheet.getRow(i);
      row.height = 20;
      row.eachCell((cell, colNumber) => {
        cell.font = { name: '微软雅黑', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        // 交替行背景色（浅蓝/白色）
        if (i % 2 === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD9E2F3' },
          };
        }

        // 评语列左对齐（内容较长）
        if (colNumber === 9) {
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'left',
            wrapText: true,
          };
        }
      });
    }

    // 3. 统计行样式：加粗 + 浅灰背景
    const statsStartRow = dataRows.length + 3; // 空行后第一行是"班级统计"
    for (let i = statsStartRow; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      row.eachCell((cell) => {
        cell.font = { name: '微软雅黑', bold: true, size: 11 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' },
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    }

    // 4. 冻结首行（表头），滚动时保持可见
    worksheet.views = [
      {
        state: 'frozen',
        ySplit: 1,
      },
    ];

    // 生成 Buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // 构建文件名：{作业标题}_成绩表.xlsx
    // 替换非法文件名字符
    const safeTitle = assignment.title.replace(/[\\/:*?"<>|]/g, '_');
    const filename = `${safeTitle}_成绩表.xlsx`;

    return { buffer: buffer as Buffer, filename };
  }
}
