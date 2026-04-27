import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ClassInfo } from './class-info.entity';
import { User } from '../../user/entities/user.entity';

@Entity('class_student')
@Unique(['class_id', 'student_id'])
export class ClassStudent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'int',
    comment: '班级ID',
  })
  class_id: number;

  @ManyToOne(() => ClassInfo)
  @JoinColumn({ name: 'class_id' })
  class_info: ClassInfo;

  @Column({
    type: 'int',
    comment: '学生ID',
  })
  student_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({
    type: 'boolean',
    default: false,
    comment: '是否是班长',
  })
  is_monitor: boolean;

  @CreateDateColumn({
    type: 'datetime',
    comment: '加入时间',
  })
  joined_at: Date;
}
