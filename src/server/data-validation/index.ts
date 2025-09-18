import { z, type ZodIssue } from "zod";
import { logger } from "../logging";

// Base validation result type (discriminated union)
export type ValidationResult<T = any> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

// Enhanced validation utilities
export class DataValidator {
  // Validate data against a Zod schema
  static validate<S extends z.ZodTypeAny>(
    schema: S,
    data: unknown,
    context?: string
  ): ValidationResult<z.infer<S>> {
    try {
      const result = schema.safeParse(data);

      if (result.success) {
        logger.debug('Data validation successful', {
          context,
          schema: schema.description || 'unknown'
        });
        return { success: true, data: result.data };
      } else {
        const errors: ValidationError[] = result.error.errors.map((err: ZodIssue) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          value: err.path.length > 0 ? this.getNestedValue(data, err.path) : data
        }));

        logger.warn('Data validation failed', {
          context,
          errors: errors.length,
          schema: schema.description || 'unknown'
        });

        return { success: false, errors };
      }
    } catch (error) {
      logger.error('Data validation error', { context, error: error as Error });
      return {
        success: false,
        errors: [{
          field: 'unknown',
          message: 'Validation process failed',
          code: 'VALIDATION_ERROR',
          value: data
        }]
      };
    }
  }

  // Get nested value from object using path array
  private static getNestedValue(obj: any, path: (string | number)[]): any {
    return path.reduce((current, key) => current?.[key], obj);
  }

  // Sanitize and validate string data
  static sanitizeString(input: string, options?: {
    maxLength?: number;
    minLength?: number;
    allowHtml?: boolean;
    allowSpecialChars?: boolean;
  }): ValidationResult<string> {
    const {
      maxLength = 10000,
      minLength = 0,
      allowHtml = false,
      allowSpecialChars = true
    } = options || {};

    try {
      if (typeof input !== 'string') {
        return {
          success: false,
          errors: [{
            field: 'input',
            message: 'Input must be a string',
            code: 'INVALID_TYPE',
            value: input
          }]
        };
      }

      let sanitized = input.trim();

      // Length validation
      if (sanitized.length < minLength) {
        return {
          success: false,
          errors: [{
            field: 'input',
            message: `String must be at least ${minLength} characters long`,
            code: 'TOO_SHORT',
            value: sanitized
          }]
        };
      }

      if (sanitized.length > maxLength) {
        return {
          success: false,
          errors: [{
            field: 'input',
            message: `String must be at most ${maxLength} characters long`,
            code: 'TOO_LONG',
            value: sanitized
          }]
        };
      }

      // HTML sanitization
      if (!allowHtml) {
        sanitized = sanitized.replace(/<[^>]*>/g, '');
      }

      // Special characters validation
      if (!allowSpecialChars) {
        const specialCharsRegex = /[<>'"&]/g;
        if (specialCharsRegex.test(sanitized)) {
          return {
            success: false,
            errors: [{
              field: 'input',
              message: 'String contains invalid special characters',
              code: 'INVALID_CHARACTERS',
              value: sanitized
            }]
          };
        }
      }

      return { success: true, data: sanitized };
    } catch (error) {
      return {
        success: false,
        errors: [{
          field: 'input',
          message: 'String sanitization failed',
          code: 'SANITIZATION_ERROR',
          value: input
        }]
      };
    }
  }

  // Validate email with enhanced checks
  static validateEmail(email: string): ValidationResult<string> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || typeof email !== 'string') {
      return {
        success: false,
        errors: [{
          field: 'email',
          message: 'Email must be a non-empty string',
          code: 'INVALID_TYPE',
          value: email
        }]
      };
    }

    const sanitized = email.trim().toLowerCase();

    if (!emailRegex.test(sanitized)) {
      return {
        success: false,
        errors: [{
          field: 'email',
          message: 'Invalid email format',
          code: 'INVALID_FORMAT',
          value: email
        }]
      };
    }

    // Additional validation for common issues
    if (sanitized.includes('..') || sanitized.startsWith('.') || sanitized.endsWith('.')) {
      return {
        success: false,
        errors: [{
          field: 'email',
          message: 'Invalid email format',
          code: 'INVALID_FORMAT',
          value: email
        }]
      };
    }

    return { success: true, data: sanitized };
  }

  // Validate URL
  static validateURL(url: string, options?: {
    requireHttps?: boolean;
    allowedDomains?: string[];
  }): ValidationResult<string> {
    const { requireHttps = false, allowedDomains = [] } = options || {};

    try {
      const urlObj = new URL(url);

      if (requireHttps && urlObj.protocol !== 'https:') {
        return {
          success: false,
          errors: [{
            field: 'url',
            message: 'URL must use HTTPS protocol',
            code: 'INSECURE_PROTOCOL',
            value: url
          }]
        };
      }

      if (allowedDomains.length > 0 && !allowedDomains.includes(urlObj.hostname)) {
        return {
          success: false,
          errors: [{
            field: 'url',
            message: `URL domain not in allowed list: ${allowedDomains.join(', ')}`,
            code: 'DOMAIN_NOT_ALLOWED',
            value: url
          }]
        };
      }

      return { success: true, data: url };
    } catch (error) {
      return {
        success: false,
        errors: [{
          field: 'url',
          message: 'Invalid URL format',
          code: 'INVALID_FORMAT',
          value: url
        }]
      };
    }
  }

  // Validate file path for security
  static validateFilePath(filePath: string): ValidationResult<string> {
    if (!filePath || typeof filePath !== 'string') {
      return {
        success: false,
        errors: [{
          field: 'filePath',
          message: 'File path must be a non-empty string',
          code: 'INVALID_TYPE',
          value: filePath
        }]
      };
    }

    // Check for directory traversal attempts
    if (filePath.includes('../') || filePath.includes('..\\')) {
      return {
        success: false,
        errors: [{
          field: 'filePath',
          message: 'File path contains directory traversal',
          code: 'DIRECTORY_TRAVERSAL',
          value: filePath
        }]
      };
    }

    // Check for absolute paths that might be problematic
    if (filePath.startsWith('/etc/') || filePath.startsWith('/bin/') || filePath.startsWith('/usr/')) {
      return {
        success: false,
        errors: [{
          field: 'filePath',
          message: 'File path points to system directory',
          code: 'SYSTEM_PATH',
          value: filePath
        }]
      };
    }

    // Windows-specific checks
    if (process.platform === 'win32') {
      if (/^[A-Z]:/i.test(filePath)) {
        return {
          success: false,
          errors: [{
            field: 'filePath',
            message: 'Absolute Windows paths not allowed',
            code: 'ABSOLUTE_PATH',
            value: filePath
          }]
        };
      }
    }

    return { success: true, data: filePath };
  }

  // Validate numeric ranges
  static validateNumber(value: any, options?: {
    min?: number;
    max?: number;
    integer?: boolean;
  }): ValidationResult<number> {
    const { min, max, integer = false } = options || {};

    if (typeof value !== 'number' || isNaN(value)) {
      return {
        success: false,
        errors: [{
          field: 'value',
          message: 'Value must be a valid number',
          code: 'INVALID_TYPE',
          value
        }]
      };
    }

    if (integer && !Number.isInteger(value)) {
      return {
        success: false,
        errors: [{
          field: 'value',
          message: 'Value must be an integer',
          code: 'NOT_INTEGER',
          value
        }]
      };
    }

    if (min !== undefined && value < min) {
      return {
        success: false,
        errors: [{
          field: 'value',
          message: `Value must be at least ${min}`,
          code: 'TOO_SMALL',
          value
        }]
      };
    }

    if (max !== undefined && value > max) {
      return {
        success: false,
        errors: [{
          field: 'value',
          message: `Value must be at most ${max}`,
          code: 'TOO_LARGE',
          value
        }]
      };
    }

    return { success: true, data: value };
  }

  // Batch validation for multiple items
  static validateBatch<S extends z.ZodTypeAny>(
    items: unknown[],
    schema: S,
    context?: string
  ): { valid: z.infer<S>[]; invalid: { index: number; errors: ValidationError[] }[] } {
    const valid: z.infer<S>[] = [];
    const invalid: { index: number; errors: ValidationError[] }[] = [];

    items.forEach((item, index) => {
      const result = this.validate(schema, item, `${context}[${index}]`);
      if (result.success) {
        valid.push(result.data);
      } else {
        invalid.push({ index, errors: result.errors });
      }
    });

    return { valid, invalid };
  }
}

// Specialized validators for common data types
export class BusinessValidators {
  // Validate user data
  static validateUserData(userData: any): ValidationResult {
    const userSchema = z.object({
      id: z.string().min(1),
      name: z.string().min(1).max(100),
      email: z.string().email(),
      role: z.enum(['user', 'admin']).optional().default('user'),
      createdAt: z.date().optional(),
      updatedAt: z.date().optional(),
    });

    return DataValidator.validate(userSchema, userData, 'user-validation');
  }

  // Validate chat message data
  static validateChatMessage(messageData: any): ValidationResult {
    const messageSchema = z.object({
      id: z.string().optional(),
      chatId: z.string().min(1),
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string().min(1).max(10000),
      userFeedback: z.enum(['like', 'dislike']).optional(),
      createdAt: z.date().optional(),
    });

    return DataValidator.validate(messageSchema, messageData, 'chat-message-validation');
  }

  // Validate model configuration
  static validateModelConfig(configData: any): ValidationResult {
    const configSchema = z.object({
      provider: z.enum(['ollama', 'openrouter-proxy']),
      baseUrl: z.string().url(),
      model: z.string().min(1).max(200),
    });

    return DataValidator.validate(configSchema, configData, 'model-config-validation');
  }

  // Validate API request data
  static validateAPIRequest(requestData: any, endpoint: string): ValidationResult {
    // Add specific validation based on endpoint
    switch (endpoint) {
      case '/api/googleai/chat':
        return DataValidator.validate(z.object({
          input: z.string().min(1).max(50000),
          mode: z.enum(['build', 'enhance']).optional(),
          taskType: z.enum(['general', 'coding', 'image', 'research', 'writing', 'marketing']).optional(),
          options: z.object({
            temperature: z.number().min(0).max(1).optional(),
            format: z.enum(['plain', 'markdown', 'json']).optional(),
          }).optional(),
        }), requestData, 'api-request-validation');

      default:
        return { success: true, data: requestData };
    }
  }
}
