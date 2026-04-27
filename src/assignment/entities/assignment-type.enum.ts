/**
 * 作业类型枚举
 * 用于区分主观题作业和客观题作业
 */
export enum AssignmentType {
  /** 主观题 - 需要AI或人工批改的开放式题目 */
  SUBJECTIVE = 'subjective',
  /** 客观题 - 选择题等有标准答案的题目 */
  OBJECTIVE = 'objective',
  // 混合类型 - 包含主观题和客观题
  MIXED = 'mixed',
}

/**
 * 作业提交状态枚举
 * 追踪学生作业提交后的处理状态
 */
export enum SubmitStatus {
  /** 待批改 - 学生刚提交，等待AI开始批改 */
  PENDING = 'pending',
  /** 批改中 - AI正在批改中 */
  GRADING = 'grading',
  /** 已完成 - AI批改完成，已返回分数和评语 */
  COMPLETED = 'completed',
  /** 批改失败 - AI批改过程中出现错误 */
  FAILED = 'failed',
}
