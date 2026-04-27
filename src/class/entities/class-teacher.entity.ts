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

@Entity('class_teacher')
@Unique(['class_id', 'teacher_id'])
export class ClassTeacher {
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
    comment: '教师ID',
  })
  teacher_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @Column({
    type: 'boolean',
    default: false,
    comment: '是否是班主任',
  })
  is_main_teacher: boolean;

  @CreateDateColumn({
    type: 'datetime',
    comment: '加入时间',
  })
  joined_at: Date;
}
