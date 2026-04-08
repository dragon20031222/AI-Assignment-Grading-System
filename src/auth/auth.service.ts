import { Injectable, Param, UnauthorizedException } from '@nestjs/common';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
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
      },
    };
  }
}
