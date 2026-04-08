export class ResponseDto<T> {
  code: number;
  message: string;
  data: T;
  timeStamp: string;
  path: string;
}

export class ResponseSuccess {
  static ok<T>(data?: T, message = 'success') {
    return {
      code: 200,
      message,
      data,
      timeStamp: new Date().toISOString(),
      path: '',
    };
  }
}
