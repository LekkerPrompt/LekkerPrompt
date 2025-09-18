import { z } from "zod";

// Common validation schemas
export const UUIDSchema = z.string().uuid();

export const EmailSchema = z.string().email().max(254);

export const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number');

export const UsernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username must be less than 50 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');

// Prompt-related schemas
export const PromptInputSchema = z.string()
  .min(1, 'Prompt cannot be empty')
  .max(50000, 'Prompt is too long (max 50,000 characters)')
  .refine(
    (val: string) => !/<script/i.test(val),
    'Prompt cannot contain script tags'
  )
  .refine(
    (val: string) => val.trim().length > 0,
    'Prompt cannot be only whitespace'
  );

export const TaskTypeSchema = z.enum([
  'general',
  'coding',
  'image',
  'research',
  'writing',
  'marketing'
]);

export const PromptModeSchema = z.enum(['build', 'enhance']);

export const FormatSchema = z.enum(['plain', 'markdown', 'json']);

export const ToneSchema = z.enum([
  'neutral',
  'friendly',
  'formal',
  'technical',
  'persuasive'
]);

export const DetailLevelSchema = z.enum(['brief', 'normal', 'detailed']);

export const StylePresetSchema = z.enum([
  'photorealistic',
  'illustration',
  '3d',
  'anime',
  'watercolor'
]);

export const AspectRatioSchema = z.enum(['1:1', '16:9', '9:16', '4:3']);

// Generation options schema
export const GenerationOptionsSchema = z.object({
  tone: ToneSchema.optional(),
  detail: DetailLevelSchema.optional(),
  format: FormatSchema.optional(),
  audience: z.string().max(100).optional(),
  language: z.string().max(50).optional(),
  styleGuidelines: z.string().max(1000).optional(),
  temperature: z.number().min(0).max(1).optional(),
  stylePreset: StylePresetSchema.optional(),
  aspectRatio: AspectRatioSchema.optional(),
  includeTests: z.boolean().optional(),
  requireCitations: z.boolean().optional(),
}).optional();

// Main prompt generation schema
export const PromptGenerationSchema = z.object({
  input: PromptInputSchema,
  mode: PromptModeSchema.default('build'),
  taskType: TaskTypeSchema.default('general'),
  options: GenerationOptionsSchema,
});

// Chat-related schemas
export const ChatMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(10000),
  userFeedback: z.enum(['like', 'dislike']).optional(),
});

export const ChatSchema = z.object({
  id: z.string().optional(),
  title: z.string().max(200).optional(),
  userId: z.string(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// File and data validation
export const FilePathSchema = z.string()
  .max(4096, 'File path is too long')
  .refine(
    (val: string) => !/\.{2}/.test(val),
    'File path cannot contain ".."'
  )
  .refine(
    (val: string) => !/[<>:"|?*]/.test(val),
    'File path contains invalid characters'
  );

export const DataDirectorySchema = z.string()
  .max(4096)
  .refine(
    (val: string) => !/\.{2}/.test(val),
    'Directory path cannot contain ".."'
  );

// Model configuration schemas
export const ModelProviderSchema = z.enum(['ollama', 'openrouter-proxy']);

export const BaseURLSchema = z.string().url().max(2048);

export const ModelNameSchema = z.string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9._-]+$/, 'Model name contains invalid characters');

export const ModelConfigSchema = z.object({
  provider: ModelProviderSchema,
  baseUrl: BaseURLSchema,
  model: ModelNameSchema,
});

// API request validation
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const SearchSchema = z.object({
  query: z.string().min(1).max(1000),
  filters: z.record(z.any()).optional(),
  pagination: PaginationSchema.optional(),
});

// Vector search validation
export const VectorSearchSchema = z.object({
  query: z.string().min(1).max(1000),
  limit: z.number().int().min(1).max(50).default(5),
  filters: z.object({
    userFeedback: z.enum(['like', 'dislike']).optional(),
    metadata: z.record(z.any()).optional(),
  }).optional(),
});

// Sanitization and security
export const SanitizedStringSchema = z.string()
  .transform((val: string) => val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''))
  .transform((val: string) => val.replace(/javascript:/gi, ''))
  .transform((val: string) => val.replace(/data:text\/html/gi, ''));

// Rate limiting validation
export const RateLimitSchema = z.object({
  windowMs: z.number().int().min(1000).max(3600000).default(60000), // 1 minute
  maxRequests: z.number().int().min(1).max(1000).default(30),
});

// Environment variable validation
export const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

// Validation utilities
export class ValidationUtils {
  static sanitizeInput(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:text\/html/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .trim();
  }

  static validateFilePath(filePath: string): boolean {
    // Check for directory traversal
    if (/\.\./.test(filePath)) return false;

    // Check for absolute paths that might be problematic
    if (filePath.includes('/etc/') || filePath.includes('/bin/') || filePath.includes('/usr/')) {
      return false;
    }

    // Check for Windows-specific issues
    if (process.platform === 'win32') {
      if (/^[a-zA-Z]:/.test(filePath)) return false; // Drive letters
    }

    return true;
  }

  static validatePromptLength(prompt: string, maxLength: number = 50000): boolean {
    return prompt.length <= maxLength && prompt.trim().length > 0;
  }

  static containsMaliciousContent(content: string): boolean {
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /data:text\/html/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /onclick=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    return maliciousPatterns.some(pattern => pattern.test(content));
  }

  static validateTemperature(temp: number): boolean {
    return typeof temp === 'number' && temp >= 0 && temp <= 1;
  }
}

// Export all schemas for easy access
export const Schemas = {
  UUID: UUIDSchema,
  Email: EmailSchema,
  Password: PasswordSchema,
  Username: UsernameSchema,
  PromptInput: PromptInputSchema,
  TaskType: TaskTypeSchema,
  PromptMode: PromptModeSchema,
  Format: FormatSchema,
  Tone: ToneSchema,
  DetailLevel: DetailLevelSchema,
  StylePreset: StylePresetSchema,
  AspectRatio: AspectRatioSchema,
  GenerationOptions: GenerationOptionsSchema,
  PromptGeneration: PromptGenerationSchema,
  ChatMessage: ChatMessageSchema,
  Chat: ChatSchema,
  FilePath: FilePathSchema,
  DataDirectory: DataDirectorySchema,
  ModelProvider: ModelProviderSchema,
  BaseURL: BaseURLSchema,
  ModelName: ModelNameSchema,
  ModelConfig: ModelConfigSchema,
  Pagination: PaginationSchema,
  Search: SearchSchema,
  VectorSearch: VectorSearchSchema,
  SanitizedString: SanitizedStringSchema,
  RateLimit: RateLimitSchema,
  Environment: EnvironmentSchema,
};
