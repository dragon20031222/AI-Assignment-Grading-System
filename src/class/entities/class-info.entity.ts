import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('class_info')
export class ClassInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 100,
    comment: '班级名称',
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: '班级描述',
  })
  description: string;

  @Column({
    type: 'varchar',
    length: 20,
    unique: true,
    comment: '邀请码（学生输入此码加入班级）',
  })
  invite_code: string;

  @Column({
    type: 'int',
    comment: '创建者ID（教师）',
  })
  creator_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @CreateDateColumn({
    type: 'datetime',
    comment: '创建时间',
  })
  created_at: Date;

  @UpdateDateColumn({
    type: 'datetime',
    comment: '更新时间',
  })
  updated_at: Date;
}
