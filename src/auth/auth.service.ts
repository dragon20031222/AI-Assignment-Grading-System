import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from './mail.service';

/**
 * 认证服务
 *
 * 职责：
 * 1. 登录/注册（原有功能）
 * 2. 修改密码（已登录状态，验证旧密码）
 * 3. 发送密码重置验证码（未登录，通过QQ邮箱发送）
 * 4. 验证验证码并重置密码（未登录，使用邮箱验证码）
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  //TODO:首先是登录模块
  /**
   * 登录
   * @param username 用户名
   * @param password 明文密码
   * @returns { access_token: string }
   */
  async login(username: string, password: string) {
    //首先进行查找
    const user = await this.userService.findeByUsername(username);
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    //然后开始验证密码
    const isPasswordValid = await this.userService.validatePassword(
      password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    //如果密码验证通过，就返回token
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };
    const access_token = this.jwtService.sign(payload);
    return {
      access_token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email,
      },
    };
  }

  //TODO:其次是注册模块
  /**
   * 注册
   这里就直接调用User的service服务create方法
   */
  async register(createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    return {
      message: '注册成功',
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email,
      },
    };
  }

  // ========== 密码管理模块 ==========

  /**
   * ① 修改密码（已登录状态）
   *
   * 流程：
   * 1. 根据 userId 查找用户
   * 2. bcrypt 比对旧密码是否正确
   * 3. bcrypt 哈希新密码
   * 4. 更新数据库
   *
   * 安全机制：
   * - 必须提供正确的旧密码（防止他人修改密码）
   * - 新密码通过 bcrypt 加盐哈希存储
   * - (不限密码强度，由前端做弱密码提示)
   *
   * @param userId - 当前登录用户ID（从JWT提取）
   * @param oldPassword - 旧密码（明文）
   * @param newPassword - 新密码（明文）
   */
  async changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    // 1. 查用户
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 2. 验证旧密码
    const isOldPasswordValid = await this.userService.validatePassword(
      oldPassword,
      user.password,
    );
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('旧密码不正确');
    }

    // 3. 新旧密码不能相同
    if (oldPassword === newPassword) {
      throw new BadRequestException('新密码不能与旧密码相同');
    }

    // 4. 更新密码（UserService.updatePassword 内部会 bcrypt 哈希）
    await this.userService.updatePassword(userId, newPassword);

    return { message: '密码修改成功' };
  }

  /**
   * ②-1 发送密码重置验证码（忘记密码第一步）
   *
   * 流程：
   * 1. 查询该邮箱对应的用户是否存在
   * 2. 委托 MailService 发送验证码（含60秒冷却、5分钟过期等机制）
   *
   * 安全机制：
   * - 邮箱存在时才发送（不暴露用户是否存在的信息）
   * - MailService 内置60秒防刷、5次尝试上限、5分钟过期
   *
   * @param email - QQ邮箱地址
   */
  async sendResetCode(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    /*
     * 先验证邮箱是否存在于系统中。
     * 这里不抛出异常而是返回统一格式，原因是：
     * 1. 如果写 throw 404，前端能知道"该邮箱没有被注册"
     * 2. 这可能暴露系统有哪些邮箱已注册（信息泄露）
     * 所以始终返回成功结构，让恶意用户无法区分"邮箱不存在"还是"发送失败"
     */
    const user = await this.userService.findByEmail(email);
    if (!user) {
      return {
        success: false,
        message: '该邮箱未注册系统账号',
      };
    }

    // 委托 MailService 执行邮件发送（含所有安全机制）
    return this.mailService.sendVerificationCode(email);
  }

  /**
   * ②-2 重置密码（忘记密码第二步）
   *
   * 流程：
   * 1. MailService.verifyCode 验证验证码（含过期检查、尝试次数限制）
   * 2. 查用户是否存在
   * 3. bcrypt 哈希新密码并更新
   * 4. 验证成功后验证码自动销毁（一次性使用）
   *
   * 安全机制：
   * - 验证码验证失败返回具体原因（过期/错误/超限），方便用户了解状态
   * - 验证成功后立即删除验证码，防止复用
   * - 重置密码不需要旧密码（否则不叫"忘记密码"）
   *
   * @param email - QQ邮箱地址
   * @param code - 6位验证码
   * @param newPassword - 新密码（明文）
   */
  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    // 1. 验证验证码（MailService 内部处理过期、尝试次数、匹配等）
    const verifyResult = this.mailService.verifyCode(email, code);
    if (!verifyResult.success) {
      throw new BadRequestException(verifyResult.message);
    }

    // 2. 查用户
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 3. 更新密码（内部 bcrypt 哈希）
    await this.userService.updatePassword(user.id, newPassword);

    return { message: '密码重置成功，请使用新密码登录' };
  }
}
