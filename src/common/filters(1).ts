import { ArgumentsHost, CallHandler, Catch, ExceptionFilter, ExecutionContext, HttpException, HttpStatus, Injectable, Logger, NestInterceptor, NestMiddleware } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { map } from 'rxjs';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private logger = new Logger('Exception');
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as any;
      message = typeof body === 'string' ? body : body.message ?? exception.message;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') { status = 409; message = 'A record with these details already exists'; }
      else if (exception.code === 'P2025') { status = 404; message = 'Record not found'; }
      else if (exception.code === 'P2003') { status = 409; message = 'This record is referenced by other data'; }
    }
    if (status >= 500) this.logger.error(`[${req.id}] ${req.method} ${String(req.originalUrl).split('?')[0]} -> ${status}`, exception instanceof Error ? exception.stack : String(exception));
    res.status(status).json({ success: false, statusCode: status, message, requestId: req.id, path: String(req.originalUrl ?? '').split('?')[0] });
  }
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler) { return next.handle().pipe(map((data) => ({ success: true, data: data ?? null }))); }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    req.id = (req.headers['x-request-id'] as string)?.slice(0, 64) || randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  }
}
