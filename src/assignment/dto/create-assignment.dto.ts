import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDateString,
  MaxLength,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssignmentType } from '../entities/assignment-type.enum';
import { QuestionType } from '../entities/question.entity';

/**
 * 创建题目的DTO（Data Transfer Object）
 * 用于在创建作业时传入题目信息
 */
export class CreateQuestionDto {
  /** 题目类型 - 主观题或客观题 */
  @IsEnum(QuestionType)
  @IsNotEmpty()
  type: QuestionType;

  /** 题目描述 - 题目的内容文本 */
  @IsString()
  @IsNotEmpty()
  description: string;

  /**
   * 选项数组 - 仅客观题需要
   * 例如：["A. 选项一", "B. 选项二", "C. 选项三", "D. 选项四"]
   */
  @IsArray()
  @IsOptional()
  options?: string[];

  /**
   * 正确答案 - 仅客观题需要
   * 可以是单个答案（如 "A"）或多个答案（如 "A,C"）
   */
  @IsString()
  @IsOptional()
  correct_answer?: string;

  /** 题目分值 - 这个题目值多少分，默认为10分 */
  @IsNumber()
  @IsOptional()
  score?: number;

  /** 题目顺序 - 在作业中的排列顺序，如不传则按数组顺序排列 */
  @IsNumber()
  @IsOptional()
  order?: number;
}

/**
 * 创建作业的DTO
 * 教师创建新作业时提交的数据结构
 */
export class CreateAssignmentDto {
  /** 作业标题 - 必填，最大200字符 */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  /** 作业描述 - 选填，作业的详细说明 */
  @IsString()
  @IsOptional()
  description?: string;

  /** 作业类型 - 必填，主观题或客观题 */
  @IsEnum(AssignmentType)
  @IsNotEmpty()
  type: AssignmentType;

  /** 是否开启查重 - 选填，默认为true，开启后会检查学生答案是否抄袭 */
  @IsBoolean()
  @IsOptional()
  check_duplicate?: boolean;

  /**
   * 评判标准（AI批改提示词）- 选填
   * 教师可以自定义AI批改时的评判标准
   * 例如："请严格按照标准答案评分，注重解题思路的表达"
   */
  @IsString()
  @IsOptional()
  grading_criteria?: string;

  /** 截止时间 - 必填，ISO 8601格式的日期字符串，如 "2024-12-31T23:59:59" */
  @IsDateString()
  @IsNotEmpty()
  deadline: string;

  /** 班级ID - 必填，作业要发布到的班级ID */
  @IsNumber()
  @IsNotEmpty()
  class_id: number;

  /**
   * 题目列表 - 选填，作业中包含的题目
   * 是一个数组，每个元素是一个题目的信息
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  @IsOptional()
  questions?: CreateQuestionDto[];
}
