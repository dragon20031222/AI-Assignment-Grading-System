import { SubmitStatus } from '../../assignment/entities/assignment-type.enum';

/**
 * 成绩统计DTO - 用于返回作业的统计信息
 * 用于老师端作业卡片列表展示
 */
export interface AssignmentGradeSummary {
  id: number;
  title: string;
  description: string;
  type: string;
  class_id: number;
  class_name: string;
  submitted_count: number;
  not_submitted_count: number;
  class_total_count: number;
  class_average_score: number | null;
  created_at: Date;
  deadline: Date;
}

/**
 * 学生成绩DTO - 用于返回单个学生的成绩信息
 * 用于老师端查看作业详情时返回学生列表
 */
export interface StudentGradeInfo {
  student_id: number;
  student_name: string;
  student_username: string;
  score: number | null;
  comment: string | null;
  status: SubmitStatus | null;
  submitted_at: Date | null;
  graded_at: Date | null;
  rank: number | null;
}

/**
 * 班级统计DTO - 用于返回班级的统计信息
 * 用于老师端查看作业详情时的班级整体情况
 */
export interface ClassGradeStats {
  total_count: number;
  submitted_count: number;
  not_submitted_count: number;
  graded_count: number;
  average_score: number | null;
  highest_score: number | null;
  lowest_score: number | null;
}

/**
 * 作业成绩详情DTO - 用于返回作业的完整成绩信息
 * 用于老师端查看某个作业的所有学生成绩
 */
export interface AssignmentGradeDetail {
  assignment_info: {
    id: number;
    title: string;
    description: string;
    type: string;
    class_id: number;
    class_name: string;
    created_at: Date;
    deadline: Date;
  };
  class_stats: ClassGradeStats;
  students: StudentGradeInfo[];
}

/**
 * 学生成绩卡片DTO - 用于学生端返回的成绩列表
 * 用于学生端"我的成绩"页面展示
 */
export interface StudentGradeCard {
  id: number;
  title: string;
  class_name: string;
  my_score: number | null;
  class_average_score: number | null;
  class_rank: number | null;
  submit_status: SubmitStatus | null;
  is_overdue: boolean;
  created_at: Date;
  deadline: Date;
}
