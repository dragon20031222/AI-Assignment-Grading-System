import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * 修改密码 DTO
 * 用户已登录，需验证旧密码
 */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  newPassword: string;
}

/**
 * 发送验证码 DTO
 * 忘记密码的第一步，输入注册邮箱
 */
export class SendResetCodeDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

/**
 * 重置密码 DTO
 * 忘记密码的第二步，验证码 + 新密码
 */
export class ResetPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  newPassword: string;
}
