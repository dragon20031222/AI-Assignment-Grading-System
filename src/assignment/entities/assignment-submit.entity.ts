import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SubmitStatus } from './assignment-type.enum';
import { Assignment } from './assignment.entity';
import { User } from '../../user/entities/user.entity';

/**
 * 作业提交实体
 * 存储学生提交的作业信息，包括答案、分数、评语等
 * 每个学生每份作业只有一条提交记录
 */
@Entity('assignment_submit')
export class AssignmentSubmit {
  /** 提交ID - 主键，自增 */
  @PrimaryGeneratedColumn()
  id: number;

  /** 作业ID - 提交的是哪个作业 */
  @Column({
    type: 'int',
    comment: '作业ID',
  })
  assignment_id: number;

  /**
   * 关联的作业对象
   * @ManyToOne - 一份提交记录对应一个作业
   */
  @ManyToOne(() => Assignment)
  @JoinColumn({ name: 'assignment_id' })
  assignment: Assignment;

  /** 学生ID - 谁提交了这个作业 */
  @Column({
    type: 'int',
    comment: '学生ID',
  })
  student_id: number;

  /**
   * 提交的学生对象
   */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  /**
   * 学生提交的答案
   * JSON格式，例如：{ "1": "这是第一题的答案", "2": "这是第二题的答案" }
   * key是题目ID，value是学生对这道题的答案
   */
  @Column({
    type: 'json',
    comment: '学生提交的答案（JSON格式）',
  })
  answers: object;

  /**
   * 答案中图片的哈希值
   * 用于查重，存储每张图片的感知哈希值
   * 格式：{ "题目ID": "哈希值", ... }
   */
  @Column({
    type: 'json',
    nullable: true,
    comment: '答案中图片的哈希值（用于查重）',
  })
  image_hashes: object;

  /** 得分 - AI批改后的分数（如果有的话） */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: '得分',
  })
  score: number;

  /** 评语 - AI给出的总体评价 */
  @Column({
    type: 'text',
    nullable: true,
    comment: '评语',
  })
  comment: string;

  /**
   * 提交状态
   * @see SubmitStatus
   * - pending: 待批改
   * - grading: 批改中
   * - completed: 已完成
   * - failed: 批改失败
   */
  @Column({
    type: 'enum',
    enum: SubmitStatus,
    default: SubmitStatus.PENDING,
    comment: '状态：pending待批改/grading批改中/completed已完成/failed批改失败',
  })
  status: SubmitStatus;

  /**
   * AI返回的原始批改结果
   * 存储AI返回的完整JSON，便于排查问题和后续分析
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: 'AI返回的原始批改结果',
  })
  ai_result: string;

  /**
   * 查重结果
   * 存储查重是否通过，以及重复的图片信息
   */
  @Column({
    type: 'json',
    nullable: true,
    comment: '查重结果',
  })
  duplicate_check_result: object;

  /** 提交时间 - 学生点击提交的时间 */
  @CreateDateColumn({
    type: 'datetime',
    comment: '提交时间',
  })
  submitted_at: Date;

  /** 批改完成时间 - AI批改完成的时间 */
  @Column({
    type: 'datetime',
    nullable: true,
    comment: '批改完成时间',
  })
  graded_at: Date;
}
