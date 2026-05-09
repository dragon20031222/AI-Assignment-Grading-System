import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  ChangePasswordDto,
  SendResetCodeDto,
  ResetPasswordDto,
} from './dto/password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

/**
 * 认证控制器
 *
 * 提供以下接口：
 * - 登录/注册（原有）
 * - 修改密码（需登录，旧密码验证）
 * - 发送重置密码验证码（无需登录，QQ邮箱）
 * - 重置密码（无需登录，邮箱验证码）
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.username, loginDto.password);
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * ① 修改密码（已登录）
   * POST /auth/change-password
   *
   * Headers: Authorization: Bearer <token>
   * Body: { oldPassword, newPassword }
   *
   * 需要验证旧密码正确后才能修改
   */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.id, // JWT payload 中的 sub 字段，validate 后映射为 id
      dto.oldPassword,
      dto.newPassword,
    );
  }

  /**
   * ②-1 发送密码重置验证码（忘记密码第一步）
   * POST /auth/send-reset-code
   *
   * Body: { email }
   *
   * 无需登录，通过 QQ邮箱 发送6位验证码
   */
  @Post('send-reset-code')
  async sendResetCode(@Body() dto: SendResetCodeDto) {
    return this.authService.sendResetCode(dto.email);
  }

  /**
   * ②-2 重置密码（忘记密码第二步）
   * POST /auth/reset-password
   *
   * Body: { email, code, newPassword }
   *
   * 用收到的验证码验证身份后设置新密码
   */
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(
      dto.email,
      dto.code,
      dto.newPassword,
    );
  }
}
