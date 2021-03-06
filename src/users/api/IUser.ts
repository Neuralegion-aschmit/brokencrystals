import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/model/user.entity';

export class IUser {
  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  public static convertToApi(user: User): IUser {
    return {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}
