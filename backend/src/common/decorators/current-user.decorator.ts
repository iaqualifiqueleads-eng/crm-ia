import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export interface CurrentUserPayload {
  sub: string;       // user id
  email: string;
  role: UserRole;
  supervisorId: string | null;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext): any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserPayload;
    return data ? user?.[data] : user;
  },
);
