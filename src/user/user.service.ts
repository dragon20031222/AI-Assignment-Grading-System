import { ConflictException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository, Like } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}
  // create(createUserDto: CreateUserDto) {
  //   const data = new User();
  //   data.username = createUserDto.username;
  //   data.password = createUserDto.password;
  //   data.role = UserRole.STUDENT;
  //   return this.userRepository.save(data);
  // }

  async create(createUserDto: CreateUserDto): Promise<User> {
    //先检查用户是否已经存在
    const existUser = await this.userRepository.findOne({
      where: { username: createUserDto.username },
    });
    if (existUser) {
      throw new ConflictException('该工号/学号已经存在');
    }

    //密码不可以明文存储，这里要进行加密
    //hash方法来给密码加盐，10是加盐轮数，越高越安全，但是也更慢
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = new User();
    user.username = createUserDto.username;
    user.password = hashedPassword;
    user.role = createUserDto.role || UserRole.STUDENT;
    user.name = createUserDto.name || '';
    user.email = createUserDto.email || '';
    return this.userRepository.save(user);
  }

  //验证密码的方法
  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    //compare方法会加密输入的密码，与存储的哈希值比对
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  //根据用户名查找用户
  async findeByUsername(username: string): Promise<User> {
    return this.userRepository.findOne({
      where: { username },
    });
  }

  /**
   * 根据用户ID查找用户
   * 用于修改密码时确认用户存在
   *
   * @param id - 用户ID
   */
  async findById(id: number): Promise<User> {
    return this.userRepository.findOne({
      where: { id },
    });
  }

  /**
   * 根据邮箱查找用户
   * 用于忘记密码时确认邮箱已注册
   *
   * @param email - QQ邮箱地址
   */
  async findByEmail(email: string): Promise<User> {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  /**
   * 更新用户密码
   *
   * 内部使用 bcrypt 加盐哈希存储，不存储明文密码。
   * 被 changePassword 和 resetPassword 共同调用。
   *
   * @param userId - 用户ID
   * @param newPassword - 新密码（明文）
   */
  async updatePassword(userId: number, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userRepository.update(userId, { password: hashedPassword });
  }
}
