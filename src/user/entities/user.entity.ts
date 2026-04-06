import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
  ADMIN = 'admin',
}

@Entity('user')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
    comment: '用户账号（唯一，用于登录）',
  })
  username: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: '加密后的用户密码',
  })
  password: string;

  // 👇 修复枚举：去掉 length
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.STUDENT,
    comment: '用户角色：student/teacher/admin',
  })
  role: UserRole;

  @Column({
    type: 'varchar',
    length: 30,
    nullable: true,
    comment: '学生学号，仅学生角色使用',
  })
  student_id: string;

  @Column({
    type: 'varchar',
    length: 30,
    nullable: true,
    comment: '教师工号，仅教师角色使用',
  })
  teacher_id: string;

  // 👇 修复：给 name 加默认值
  @Column({
    type: 'varchar',
    length: 50,
    default: '', // 👈 关键！允许为空，注册时不用传
    comment: '用户姓名',
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '用户邮箱',
  })
  email: string;

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
