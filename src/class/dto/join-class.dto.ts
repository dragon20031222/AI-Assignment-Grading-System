import { IsString, IsNotEmpty, Length } from 'class-validator';

export class JoinClassDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 20)
  invite_code: string;
}
