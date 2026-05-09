import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MailService } from './mail.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserService } from '../user/user.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from 'src/user/user.module';

/**
 * 认证模块
 *
 * 整合作者的认证服务：
 * - 登录/注册（JWT Token）
 * - 修改密码（旧密码验证）
 * - 忘记密码（QQ邮箱验证码 + SMTP）
 */
@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.register({
      // 密钥,现在是开发，生产环境不可以用硬编码，最好在根目录创建.env文件，里面包含JWT_SECRET
      // 这里为了方便，先硬编码一个,到时候去网站random.org/strings/生成
      // 生产环境中，应该从.env文件中读JWT_SECRET
      secret: process.env.JWT_SECRET || 'my-super-secret-key-123456',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    MailService, // QQ邮箱验证码发送服务
  ],
  exports: [AuthService],
})
export class AuthModule {}
