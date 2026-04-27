import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AssignmentType } from './assignment-type.enum';
import { ClassInfo } from '../../class/entities/class-info.entity';
import { User } from '../../user/entities/user.entity';

/**
 * 作业实体
 * 存储教师创建的作业信息
 * 每个作业属于一个班级，由一位教师创建
 */
@Entity('assignment')
export class Assignment {
  /** 作业ID - 主键，自增 */
  @PrimaryGeneratedColumn()
  id: number;

  /** 作业标题 - 如"第一章课后习题" */
  @Column({
    type: 'varchar',
    length: 200,
    comment: '作业标题',
  })
  title: string;

  /** 作业描述 - 作业的详细说明 */
  @Column({
    type: 'text',
    nullable: true,
    comment: '作业描述',
  })
  description: string;

  /**
   * 作业类型 - 主观题或客观题
   * @see AssignmentType
   */
  @Column({
    type: 'enum',
    enum: AssignmentType,
    comment: '作业类型：subjective主观题/objective客观题/mixed混合类型',
  })
  type: AssignmentType;

  /**
   * 是否开启查重
   * 开启后，学生提交的内容会与数据库中已有答案比对相似度
   */
  @Column({
    type: 'boolean',
    default: true,
    comment: '是否开启查重',
  })
  check_duplicate: boolean;

  /**
   * 评判标准（AI批改提示词）
   * 教师可以自定义AI批改时的评判标准/提示词
   * 例如："请严格按照标准答案评分，注重解题思路"
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '评判标准（AI批改提示词）',
  })
  grading_criteria: string;

  /** 截止时间 - 学生必须在此时间前提交 */
  @Column({
    type: 'datetime',
    comment: '截止时间',
  })
  deadline: Date;

  /** 班级ID - 这个作业属于哪个班级 */
  @Column({
    type: 'int',
    comment: '关联班级ID',
  })
  class_id: number;

  /**
   * 关联的班级对象
   * @ManyToOne - 多个作业可以属于同一个班级
   */
  @ManyToOne(() => ClassInfo)
  @JoinColumn({ name: 'class_id' })
  class_info: ClassInfo;

  /** 创建者ID - 创建这个作业的教师ID */
  @Column({
    type: 'int',
    comment: '创建者ID（教师）',
  })
  creator_id: number;

  /**
   * 创建者对象 - 关联的教师用户
   */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  /** 创建时间 - 作业创建的时间 */
  @CreateDateColumn({
    type: 'datetime',
    comment: '创建时间',
  })
  created_at: Date;

  /** 更新时间 - 作业信息最后修改的时间 */
  @UpdateDateColumn({
    type: 'datetime',
    comment: '更新时间',
  })
  updated_at: Date;
}
