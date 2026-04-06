import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  IsNotEmpty,
} from 'class-validator';
export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @IsNotEmpty()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  role?: string;
}
