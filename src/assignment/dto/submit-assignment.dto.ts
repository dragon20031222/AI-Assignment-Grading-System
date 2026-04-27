import { IsNumber, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

/**
 * 提交作业的DTO
 * 学生提交作业时提交的数据结构
 */
export class SubmitAssignmentDto {
  /** 作业ID - 必填，要提交哪个作业 */
  @IsNumber()
  @IsNotEmpty()
  assignment_id: number;

  /**
   * 学生提交的答案 - 必填，JSON对象格式
   * key是题目ID（字符串），value是学生对这道题的答案
   *
   * 答案可以是：
   * - 文本答案：如 "这是第一题的回答"
   * - 图片URL：如 "/uploads/img-xxx.png"（上传后的访问路径）
   *
   * 示例：
   * {
   *   "1": "这是第一题的回答",
   *   "2": "/uploads/img-123.png",
   *   "3": ["文字说明", "/uploads/img-456.png"]
   * }
   */
  @IsObject()
  @IsNotEmpty()
  answers: object;
}
