import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Assignment } from './assignment.entity';

/**
 * 题目类型枚举
 * 单个题目的类型（与作业类型类似，但针对单个题目）
 */
export enum QuestionType {
  /** 主观题 - 简答题、论述题等 */
  SUBJECTIVE = 'subjective',
  /** 客观题 - 选择题、判断题等 */
  OBJECTIVE = 'objective',
  // 混合类型 - 包含主观题和客观题
  MIXED = 'mixed',
}

/**
 * 题目实体
 * 存储作业中的单个题目信息
 * 一个作业可以包含多个题目，它们通过 assignment_id 关联
 */
@Entity('question')
export class Question {
  /** 题目ID - 主键，自增 */
  @PrimaryGeneratedColumn()
  id: number;

  /** 作业ID - 关联到哪个作业 */
  @Column({
    type: 'int',
    comment: '作业ID',
  })
  assignment_id: number;

  /**
   * 关联的作业对象
   * @ManyToOne - 多对一关系，多个题目可以属于同一个作业
   * @JoinColumn - 明确外键列名
   */
  @ManyToOne(() => Assignment)
  @JoinColumn({ name: 'assignment_id' })
  assignment: Assignment;

  /** 题目类型 - 主观题或客观题 */
  @Column({
    type: 'enum',
    enum: QuestionType,
    comment: '题目类型：subjective主观题/objective客观题',
  })
  type: QuestionType;

  /** 题目描述 - 题目的内容文本 */
  @Column({
    type: 'text',
    comment: '题目描述',
  })
  description: string;

  /**
   * 选项数组 - 仅客观题使用
   * 例如：["A. 选项一", "B. 选项二", "C. 选项三", "D. 选项四"]
   */
  @Column({
    type: 'json',
    nullable: true,
    comment: '选项（客观题用，JSON数组格式）',
  })
  options: string[];

  /**
   * 正确答案 - 仅客观题使用
   * 可以是单个答案（如 "A"）或多个答案（如 "A,C"）
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '正确答案（客观题用）',
  })
  correct_answer: string;

  /** 题目分值 - 这个题目值多少分 */
  @Column({
    type: 'int',
    default: 10,
    comment: '题目分值',
  })
  score: number;

  /** 题目顺序 - 在作业中的排列顺序，1表示第一题 */
  @Column({
    type: 'int',
    default: 1,
    comment: '题目顺序',
  })
  order: number;
}
