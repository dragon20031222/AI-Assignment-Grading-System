import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssignmentSubmit } from '../assignment/entities/assignment-submit.entity';

/**
 * 图片查重服务
 * 使用感知哈希（Perceptual Hash）算法计算图片相似度
 *
 * 原理：
 * 1. 对图片进行缩放、降维等处理
 * 2. 计算图片的感知哈希值（pHash）
 * 3. 比较两个哈希值的汉明距离（Hamming Distance）
 * 4. 汉明距离越小，图片越相似
 *
 * 查重阈值说明：
 * - 汉明距离 <= 5：图片几乎相同
 * - 汉明距离 <= 10：图片非常相似
 * - 汉明距离 <= 15：图片有些相似
 * - 汉明距离 > 15：图片不同
 */
@Injectable()
export class DuplicateCheckService {
  private readonly imageHash: Function;

  constructor(
    @InjectRepository(AssignmentSubmit)
    private submitRepository: Repository<AssignmentSubmit>,
  ) {
    // 使用 require 加载 image-hash
    const imageHashModule = require('image-hash');
    this.imageHash = imageHashModule.imageHash || imageHashModule;
  }

  /**
   * 计算单张图片的哈希值
   *
   * @param imagePath - 图片文件路径
   * @returns 图片的16进制哈希字符串
   */
  async getImageHash(imagePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.imageHash(imagePath, 16, 'sha256', (err, hash) => {
        if (err) {
          reject(new Error(`计算图片哈希失败: ${err.message}`));
        } else {
          resolve(hash);
        }
      });
    });
  }

  /**
   * 计算两张图片的相似度
   *
   * @param hash1 - 第一张图片的哈希值
   * @param hash2 - 第二张图片的哈希值
   * @returns 汉明距离（0-64，0表示完全相同）
   */
  calculateSimilarity(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) {
      throw new Error('哈希长度不一致，无法比较');
    }

    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        distance++;
      }
    }
    return distance;
  }

  /**
   * 判断两张图片是否重复
   * 默认阈值：汉明距离 <= 10 视为重复
   *
   * @param hash1 - 第一张图片的哈希值
   * @param hash2 - 第二张图片的哈希值
   * @param threshold - 查重阈值，默认10
   * @returns 是否重复
   */
  isDuplicate(hash1: string, hash2: string, threshold: number = 10): boolean {
    const distance = this.calculateSimilarity(hash1, hash2);
    return distance <= threshold;
  }

  /**
   * 获取相似度百分比
   *
   * @param hash1 - 第一张图片的哈希值
   * @param hash2 - 第二张图片的哈希值
   * @returns 相似度百分比（0-100）
   */
  getSimilarityPercent(hash1: string, hash2: string): number {
    const distance = this.calculateSimilarity(hash1, hash2);
    // 哈希长度是64位（image-hash默认）
    const maxDistance = 64;
    const similarity = ((maxDistance - distance) / maxDistance) * 100;
    return Math.round(similarity * 100) / 100; // 保留2位小数
  }

  /**
   * 计算答案中所有图片的哈希值
   *
   * @param answers - 学生提交的答案对象
   * @returns 包含题目ID和对应图片哈希值的对象
   *
   * 例如：
   * {
   *   "1": "abcd1234...",  // 题目1的图片哈希
   *   "3": "efgh5678..."   // 题目3的图片哈希
   * }
   */
  async calculateImageHashes(
    answers: Record<string, any>,
  ): Promise<Record<string, string>> {
    const hashes: Record<string, string> = {};
    const images = this.extractImagesFromAnswers(answers);

    for (const { questionId, imagePath } of images) {
      try {
        // 将URL路径转换为实际文件路径
        // 例如：/uploads/img-xxx.png -> ./uploads/img-xxx.png
        const actualPath = this.urlToFilePath(imagePath);
        const hash = await this.getImageHash(actualPath);
        hashes[questionId] = hash;
      } catch (error) {
        console.error(`计算图片哈希失败: ${imagePath}`, error);
      }
    }

    return hashes;
  }

  /**
   * 将URL路径转换为实际文件路径
   *
   * @param urlPath - URL路径，如 /uploads/img-xxx.png
   * @returns 实际文件路径，如 ./uploads/img-xxx.png
   */
  private urlToFilePath(urlPath: string): string {
    // 移除开头的 /
    const cleanPath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
    // 返回相对路径
    return `./${cleanPath}`;
  }

  /**
   * 对学生提交的作业进行查重
   * 检查该学生提交的答案中是否有图片与其他已提交作业的图片重复
   *
   * @param assignmentId - 作业ID
   * @param studentId - 学生ID
   * @param answers - 学生提交的答案（包含图片路径）
   * @returns 查重结果
   *
   * 返回格式：
   * {
   *   isDuplicate: boolean,      // 是否有重复
   *   duplicates: [              // 重复的图片列表
   *     {
   *       questionId: string,    // 题目ID
   *       submittedImage: string, // 提交的图片
   *       similarImage: string,   // 相似的图片（可能是其他学生的）
   *       similarity: number,     // 相似度百分比
   *       hammingDistance: number // 汉明距离
   *     }
   *   ]
   * }
   */
  async checkDuplicate(
    assignmentId: number,
    studentId: number,
    answers: Record<string, any>,
  ): Promise<{ isDuplicate: boolean; duplicates: any[] }> {
    const duplicates: any[] = [];

    // 找出答案中的所有图片文件
    const submittedImages = this.extractImagesFromAnswers(answers);

    if (submittedImages.length === 0) {
      // 没有图片，无需查重
      return { isDuplicate: false, duplicates: [] };
    }

    // 获取该作业的所有其他学生的提交（排除当前学生）
    const otherSubmits = await this.submitRepository.find({
      where: {
        assignment_id: assignmentId,
      },
    });

    // 过滤掉当前学生的提交
    const otherStudentSubmits = otherSubmits.filter(
      (s) => s.student_id !== studentId,
    );

    // 对每张提交的图片刻算哈希
    const submittedHashes: Map<string, { hash: string; questionId: string }> =
      new Map();

    for (const { questionId, imagePath } of submittedImages) {
      try {
        const hash = await this.getImageHash(imagePath);
        submittedHashes.set(imagePath, { hash, questionId });
      } catch (error) {
        console.error(`计算图片哈希失败: ${imagePath}`, error);
      }
    }

    // 与其他学生的提交进行比较
    for (const submit of otherStudentSubmits) {
      const otherAnswers = submit.answers as Record<string, any>;
      const otherImages = this.extractImagesFromAnswers(otherAnswers);

      for (const [
        submittedPath,
        { hash: submittedHash, questionId },
      ] of submittedHashes) {
        for (const {
          questionId: otherQuestionId,
          imagePath: otherPath,
        } of otherImages) {
          try {
            const otherHash = await this.getImageHash(otherPath);
            const hammingDistance = this.calculateSimilarity(
              submittedHash,
              otherHash,
            );
            const similarity = this.getSimilarityPercent(
              submittedHash,
              otherHash,
            );

            // 如果相似度超过阈值，记录为重复
            if (hammingDistance <= 10) {
              duplicates.push({
                questionId,
                submittedImage: submittedPath,
                similarImage: otherPath,
                similarity,
                hammingDistance,
                similarSubmitId: submit.id,
                similarStudentId: submit.student_id,
              });
            }
          } catch (error) {
            console.error(
              `比较图片失败: ${submittedPath} vs ${otherPath}`,
              error,
            );
          }
        }
      }
    }

    return {
      isDuplicate: duplicates.length > 0,
      duplicates,
    };
  }

  /**
   * 从答案中提取所有图片路径
   *
   * @param answers - 答案对象
   * @returns 图片路径列表，每项包含题目ID和图片路径
   */
  private extractImagesFromAnswers(
    answers: Record<string, any>,
  ): { questionId: string; imagePath: string }[] {
    const images: { questionId: string; imagePath: string }[] = [];

    for (const [questionId, answer] of Object.entries(answers)) {
      if (typeof answer === 'string' && this.isImagePath(answer)) {
        images.push({ questionId, imagePath: answer });
      } else if (Array.isArray(answer)) {
        // 如果答案是数组，递归检查
        for (const item of answer) {
          if (typeof item === 'string' && this.isImagePath(item)) {
            images.push({ questionId, imagePath: item });
          }
        }
      }
    }

    return images;
  }

  /**
   * 判断字符串是否为图片路径
   *
   * @param str - 待检查的字符串
   * @returns 是否为图片路径
   */
  private isImagePath(str: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const lower = str.toLowerCase();
    return imageExtensions.some((ext) => lower.endsWith(ext));
  }
}
