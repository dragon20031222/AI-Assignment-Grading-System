import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * 验证码存储结构
 *
 * 纯内存存储，不使用数据库，原因：
 * 1. 验证码有生命周期（5分钟），不需要持久化
 * 2. 自动过期清理，比数据库定时任务更轻量
 * 3. 降低数据库压力，避免无用数据堆积
 */
interface CodeRecord {
  /** 6位数字验证码 */
  code: string;
  /** 过期时间戳（毫秒） */
  expiresAt: number;
  /** 已尝试次数，超过5次自动作废 */
  attempts: number;
}

/**
 * 邮件服务
 *
 * 职责：
 * 1. 初始化 QQ邮箱 SMTP 连接（应用启动时创建，复用连接池）
 * 2. 生成6位数字验证码并发送到指定邮箱
 * 3. 内存管理验证码（存储、验证、清理）
 *
 * 安全机制：
 * - 同一邮箱60秒内不允许重复发送（防短信轰炸）
 * - 验证码5分钟过期
 * - 最多尝试5次，超限自动作废（防暴力破解）
 * - 每30秒扫描并清理过期记录
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  /**
   * nodemailer 邮件传输器
   * 使用 QQ邮箱 SMTP + SSL(465端口) 发送邮件
   */
  private transporter: Transporter;

  /**
   * 验证码内存存储
   *
   * Key: 邮箱地址
   * Value: { code, expiresAt, attempts }
   */
  private codeStore: Map<string, CodeRecord> = new Map();

  /**
   * 同一邮箱最短发送间隔（毫秒）
   * 60秒内不允许重复发送
   */
  private readonly SEND_INTERVAL = 60 * 1000;

  /**
   * 验证码有效期（毫秒）
   * 5分钟后自动过期
   */
  private readonly CODE_EXPIRE = 5 * 60 * 1000;

  /**
   * 验证码最大尝试次数
   * 超过5次验证码自动作废
   */
  private readonly MAX_ATTEMPTS = 5;

  /**
   * 上一次发送时间记录
   * Key: 邮箱地址
   * Value: 上次发送的时间戳（毫秒）
   */
  private lastSendTime: Map<string, number> = new Map();

  constructor(private readonly configService: ConfigService) {
    // 应用启动时初始化 QQ邮箱 SMTP 连接
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST', 'smtp.qq.com'),
      port: this.configService.get<number>('MAIL_PORT', 465),
      secure: true, // QQ邮箱 SMTP 使用 SSL
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'), // SMTP 授权码，不是 QQ密码
      },
    });

    // 启动定时清理任务：每30秒清除过期的验证码记录
    setInterval(() => this.cleanExpiredCodes(), 30 * 1000);
  }

  /**
   * 发送验证码到指定邮箱
   *
   * 流程：
   * 1. 检查是否在60秒冷却期内
   * 2. 生成6位数字验证码（100000 ~ 999999）
   * 3. 存入内存 Map
   * 4. 调用 nodemailer 发送邮件
   *
   * @param email - 目标QQ邮箱地址
   * @returns 成功/失败信息
   */
  async sendVerificationCode(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    // 检查发送间隔（60秒冷却期）
    const lastTime = this.lastSendTime.get(email);
    if (lastTime && Date.now() - lastTime < this.SEND_INTERVAL) {
      const remainingSeconds = Math.ceil(
        (this.SEND_INTERVAL - (Date.now() - lastTime)) / 1000,
      );
      return {
        success: false,
        message: `请等待 ${remainingSeconds} 秒后再发送验证码`,
      };
    }

    // 生成6位随机数字验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // 存入内存
    this.codeStore.set(email, {
      code,
      expiresAt: Date.now() + this.CODE_EXPIRE,
      attempts: 0,
    });

    // 记录本次发送时间
    this.lastSendTime.set(email, Date.now());

    // 发送邮件
    try {
      await this.transporter.sendMail({
        from: {
          name: 'AI作业批改系统',
          address: this.configService.get<string>('MAIL_FROM'),
        },
        to: email,
        subject: '【AI作业批改系统】密码重置验证码',
        html: `
          <div style="max-width: 480px; margin: 0 auto; padding: 20px;
                      font-family: 'Microsoft YaHei', Arial, sans-serif;
                      border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #4472C4; text-align: center;">AI作业批改系统</h2>
            <p style="font-size: 16px; color: #333;">您好，您正在重置密码。</p>
            <p style="font-size: 14px; color: #666;">您的验证码是：</p>
            <div style="text-align: center; margin: 24px 0;">
              <span style="display: inline-block; padding: 12px 32px;
                           font-size: 28px; font-weight: bold; color: #4472C4;
                           background: #f0f4fc; border-radius: 6px;
                           letter-spacing: 6px;">${code}</span>
            </div>
            <p style="font-size: 12px; color: #999;">
              验证码有效期为 <strong>5分钟</strong>，请勿向任何人透露验证码。
            </p>
            <p style="font-size: 12px; color: #999;">
              如果不是您本人操作，请忽略此邮件。
            </p>
          </div>
        `,
      });

      this.logger.log(`验证码已发送至 ${email}`);

      return {
        success: true,
        message: '验证码已发送，请检查您的QQ邮箱',
      };
    } catch (error) {
      this.logger.error(`发送验证码到 ${email} 失败:`, error);
      // 发送失败时清除验证码记录
      this.codeStore.delete(email);
      this.lastSendTime.delete(email);

      return {
        success: false,
        message: '验证码发送失败，请稍后重试',
      };
    }
  }

  /**
   * 验证验证码是否正确
   *
   * @param email - 邮箱地址
   * @param code - 用户输入的6位验证码
   * @returns 验证结果
   */
  verifyCode(
    email: string,
    code: string,
  ): { success: boolean; message: string } {
    const record = this.codeStore.get(email);

    // 验证码不存在（未发送或已过期被清理）
    if (!record) {
      return {
        success: false,
        message: '验证码不存在或已过期，请重新获取',
      };
    }

    // 检查是否过期（5分钟）
    if (Date.now() > record.expiresAt) {
      this.codeStore.delete(email);
      return {
        success: false,
        message: '验证码已过期，请重新获取',
      };
    }

    // 增加尝试次数
    record.attempts++;

    // 检查尝试次数是否超过限制
    if (record.attempts > this.MAX_ATTEMPTS) {
      this.codeStore.delete(email);
      return {
        success: false,
        message: '验证码尝试次数过多，已作废，请重新获取',
      };
    }

    // 验证码不正确
    if (record.code !== code) {
      return {
        success: false,
        message: `验证码错误（剩余尝试次数：${this.MAX_ATTEMPTS - record.attempts}）`,
      };
    }

    // 验证成功，删除验证码（一次性使用）
    this.codeStore.delete(email);
    this.lastSendTime.delete(email);

    return {
      success: true,
      message: '验证成功',
    };
  }

  /**
   * 检查邮箱是否存在验证码记录
   * 用于前端判断是否需要显示"重新发送"按钮
   *
   * @param email - 邮箱地址
   * @returns 是否存在有效验证码
   */
  hasActiveCode(email: string): boolean {
    const record = this.codeStore.get(email);
    if (!record) return false;
    if (Date.now() > record.expiresAt) {
      this.codeStore.delete(email);
      return false;
    }
    return true;
  }

  /**
   * 定时清理过期的验证码记录
   *
   * 每30秒自动执行一次，遍历所有记录并删除过期的，
   * 防止内存泄漏。
   */
  private cleanExpiredCodes(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [email, record] of this.codeStore) {
      if (now > record.expiresAt) {
        this.codeStore.delete(email);
        this.lastSendTime.delete(email);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`清理了 ${cleanedCount} 条过期验证码记录`);
    }
  }
}
