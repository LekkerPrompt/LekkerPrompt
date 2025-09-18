import { NextResponse } from "next/server";
import { ZodError } from "zod";

export interface APIError {
  code: string;
  message: string;
  details?: any;
  statusCode: number;
}

// Standard error codes and their corresponding HTTP status codes
export const ERROR_CODES = {
  // Authentication errors
  UNAUTHORIZED: { statusCode: 401, message: 'Authentication required' },
  FORBIDDEN: { statusCode: 403, message: 'Access forbidden' },

  // Validation errors
  INVALID_REQUEST: { statusCode: 400, message: 'Invalid request' },
  VALIDATION_ERROR: { statusCode: 400, message: 'Validation failed' },

  // Resource errors
  NOT_FOUND: { statusCode: 404, message: 'Resource not found' },
  CONFLICT: { statusCode: 409, message: 'Resource conflict' },

  // Server errors
  INTERNAL_ERROR: { statusCode: 500, message: 'Internal server error' },
  SERVICE_UNAVAILABLE: { statusCode: 503, message: 'Service unavailable' },

  // Rate limiting
  RATE_LIMITED: { statusCode: 429, message: 'Too many requests' },

  // External service errors
  EXTERNAL_SERVICE_ERROR: { statusCode: 502, message: 'External service error' },
  EXTERNAL_TIMEOUT: { statusCode: 504, message: 'External service timeout' }
} as const;

export class APIErrorHandler {
  private static logError(error: APIError, originalError?: Error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] API Error:`, {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
      stack: originalError?.stack
    });
  }

  static createError(
    code: keyof typeof ERROR_CODES,
    customMessage?: string,
    details?: any,
    originalError?: Error
  ): APIError {
    const errorConfig = ERROR_CODES[code];
    const error: APIError = {
      code,
      message: customMessage || errorConfig.message,
      statusCode: errorConfig.statusCode,
      details
    };

    this.logError(error, originalError);
    return error;
  }

  static handleZodError(error: ZodError): APIError {
    const validationErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }));

    return this.createError(
      'VALIDATION_ERROR',
      'Request validation failed',
      { validationErrors },
      error
    );
  }

  static handleDatabaseError(error: Error): APIError {
    // Check for specific database error types
    if (error.message.includes('not found') || error.message.includes('does not exist')) {
      return this.createError('NOT_FOUND', 'Resource not found', undefined, error);
    }

    if (error.message.includes('unique constraint') || error.message.includes('already exists')) {
      return this.createError('CONFLICT', 'Resource already exists', undefined, error);
    }

    return this.createError('INTERNAL_ERROR', 'Database operation failed', undefined, error);
  }

  static handleExternalServiceError(error: Error, serviceName: string): APIError {
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return this.createError(
        'EXTERNAL_TIMEOUT',
        `${serviceName} request timeout`,
        { service: serviceName },
        error
      );
    }

    return this.createError(
      'EXTERNAL_SERVICE_ERROR',
      `${serviceName} service error`,
      { service: serviceName },
      error
    );
  }

  static handleGenericError(error: Error): APIError {
    // Try to categorize the error based on its message or type
    if (error.message.includes('unauthorized') || error.message.includes('not authenticated')) {
      return this.createError('UNAUTHORIZED', undefined, undefined, error);
    }

    if (error.message.includes('forbidden') || error.message.includes('not allowed')) {
      return this.createError('FORBIDDEN', undefined, error);
    }

    if (error.message.includes('not found')) {
      return this.createError('NOT_FOUND', undefined, error);
    }

    // Default to internal server error
    return this.createError('INTERNAL_ERROR', undefined, undefined, error);
  }

  static toNextResponse(error: APIError): NextResponse {
    const responseBody = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details })
      }
    };

    // Don't expose internal details in production for security
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && error.statusCode >= 500) {
      responseBody.error.message = 'An unexpected error occurred';
      delete responseBody.error.details;
    }

    return NextResponse.json(responseBody, { status: error.statusCode });
  }
}

// Helper function to wrap API route handlers with error handling
export function withErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ZodError) {
        const apiError = APIErrorHandler.handleZodError(error);
        return APIErrorHandler.toNextResponse(apiError);
      }

      if (error instanceof Error) {
        // Check if it's a known error type
        if (error.message.includes('database') || error.message.includes('JSONStore')) {
          const apiError = APIErrorHandler.handleDatabaseError(error);
          return APIErrorHandler.toNextResponse(apiError);
        }

        if (error.message.includes('fetch') || error.message.includes('network')) {
          const apiError = APIErrorHandler.handleExternalServiceError(error, 'External Service');
          return APIErrorHandler.toNextResponse(apiError);
        }

        const apiError = APIErrorHandler.handleGenericError(error);
        return APIErrorHandler.toNextResponse(apiError);
      }

      // Unknown error type
      const apiError = APIErrorHandler.createError('INTERNAL_ERROR', 'Unknown error occurred', { errorType: typeof error });
      return APIErrorHandler.toNextResponse(apiError);
    }
  };
}

// Helper function for creating success responses
export function createSuccessResponse(data: any, statusCode: number = 200): NextResponse {
  return NextResponse.json({ data }, { status: statusCode });
}

// Helper function for creating error responses
export function createErrorResponse(
  code: keyof typeof ERROR_CODES,
  customMessage?: string,
  details?: any
): NextResponse {
  const error = APIErrorHandler.createError(code, customMessage, details);
  return APIErrorHandler.toNextResponse(error);
}
