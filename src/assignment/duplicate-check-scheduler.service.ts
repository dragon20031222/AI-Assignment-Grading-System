import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assignment } from './entities/assignment.entity';
import { AssignmentSubmit } from './entities/assignment-submit.entity';
import { DuplicateCheckService } from '../upload/duplicate-check.service';

/**
 * 查重定时任务调度服务
 *
 * 负责在作业截止时间到达后，自动对开启了查重的作业执行全量查重。
 *
 * 注意：本服务不依赖 AssignmentService，而是直接注入 Repository 和
 * DuplicateCheckService（全部为静态 Provider），以避免因
 * AssignmentService 中包含 @Inject(REQUEST) 请求作用域依赖，
 * 导致 @nestjs/schedule 拒绝注册 Cron 任务。
 *
 * 执行策略：
 * - 每5分钟扫描一次所有已截止且开启了查重的作业
 * - 对每个符合条件的作业进行全量两两比对
 * - 查重结果标记 checkedBy: 'system'
 */
@Injectable()
export class DuplicateCheckSchedulerService {
  constructor(
    /** 作业 Repository - 查询已截止且开启查重的作业 */
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
    /** 提交 Repository - 更新查重结果到每条提交记录 */
    @InjectRepository(AssignmentSubmit)
    private readonly submitRepository: Repository<AssignmentSubmit>,
    /** 图片查重服务 - 执行全量两两比对 */
    private readonly duplicateCheckService: DuplicateCheckService,
  ) {}

  /**
   * 定时自动查重任务
   *
   * 每5分钟执行一次，扫描所有已截止且开启了查重的作业，
   * 对提交的图片进行全量两两比对查重。
   *
   * Cron 表达式: 每5分钟 (即每小时的 0、5、10、15...55 分执行)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleAutoDuplicateCheck(): Promise<void> {
    console.log('[定时任务] 开始执行自动查重扫描...');

    try {
      const result = await this.runAutoDuplicateCheck();

      console.log(
        `[定时任务] 自动查重扫描完成，本次处理了 ${result.processedCount} 个作业`,
      );

      if (result.details.length > 0) {
        for (const detail of result.details) {
          if (detail.success) {
            console.log(
              `  - 作业"${detail.title}": ${detail.totalSubmits}个提交, ` +
                `${detail.duplicateSubmits}个疑似重复`,
            );
          } else {
            console.log(
              `  - 作业"${detail.title}": 查重失败 - ${detail.error}`,
            );
          }
        }
      }
    } catch (error) {
      console.error('[定时任务] 自动查重扫描执行失败:', error);
    }
  }

  /**
   * 核心自动查重逻辑
   *
   * 扫描所有 check_duplicate = true 且 deadline 已过的作业，
   * 对其所有提交执行全量查重，并将结果写入每条提交记录的
   * duplicate_check_result 字段。
   *
   * @returns 处理结果汇总
   */
  private async runAutoDuplicateCheck(): Promise<{
    processedCount: number;
    details: any[];
  }> {
    const now = new Date();
    const details: any[] = [];

    // 查找所有开启了查重的作业（需要在内存中过滤已截止的）
    const allCheckAssignments = await this.assignmentRepository.find({
      where: { check_duplicate: true },
    });

    // 筛选出已截止的作业（deadline < now）
    const overdueAssignments = allCheckAssignments.filter(
      (a) => new Date(a.deadline) < now,
    );

    for (const assignment of overdueAssignments) {
      try {
        // 对该作业所有提交执行全量两两比对查重
        const duplicateResults =
          await this.duplicateCheckService.checkAllDuplicatesForAssignment(
            assignment.id,
          );

        let duplicateSubmits = 0;

        // 将查重结果写入每条提交记录的 duplicate_check_result 字段
        for (const [submitId, result] of duplicateResults) {
          await this.submitRepository.update(submitId, {
            duplicate_check_result: {
              isDuplicate: result.isDuplicate,
              duplicates: result.duplicates,
              checkedAt: new Date(),
              checkedBy: 'system', // 标记为系统自动执行，与教师手动区分
            },
          });

          if (result.isDuplicate) {
            duplicateSubmits++;
          }
        }

        details.push({
          assignmentId: assignment.id,
          title: assignment.title,
          totalSubmits: duplicateResults.size,
          duplicateSubmits,
          success: true,
        });

        console.log(
          `[自动查重] 作业"${assignment.title}"(ID:${assignment.id}) 查重完成，` +
            `共${duplicateResults.size}个提交，${duplicateSubmits}个疑似重复`,
        );
      } catch (error) {
        console.error(
          `[自动查重] 作业"${assignment.title}"(ID:${assignment.id}) 查重失败:`,
          error,
        );
        details.push({
          assignmentId: assignment.id,
          title: assignment.title,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      processedCount: overdueAssignments.length,
      details,
    };
  }
}
