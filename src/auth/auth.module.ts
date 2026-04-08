import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserService } from '../user/user.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.register({
      // 密钥,现在是开发，生产环境不可以用硬编码，最好在根目录创建.env文件，里面包含JWT_SECRET
      // 这里为了方便，先硬编码一个,到时候去网站random.org/strings/生成
      // 生产环境中，应该从.env文件中读JWT_SECRET
      secret: 'my-super-secret-key-123456',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
