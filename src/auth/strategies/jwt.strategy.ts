import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from 'src/user/user.service';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly UserService: UserService) {
    super({
      //从请求头里面提取jwt
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      //自己的密钥
      secretOrKey: 'my-super-secret-key-123456',
      //是否忽略过期时间
      ignoreExpiration: false,
    });
  }

  /**
   * 验证 Token 成功后会调用此方法
   * @param payload Token 中的用户信息
   */
  async validate(payload: any) {
    // const user = await this.UserService.findOne(payload.sub);
    // if (!user) {
    //   throw new UnauthorizedException('用户不存在');
    // }
    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
    };
  }
}
