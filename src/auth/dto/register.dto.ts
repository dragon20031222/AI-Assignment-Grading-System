import {
  IsString,
  MinLength,
  IsEmail,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { UserRole } from 'src/user/entities/user.entity';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}
