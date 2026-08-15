import { z } from 'zod';

export const signupSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    // Lowercased before validation, so typing "SageX" submits "sagex" and the
    // handle a user sees is the handle that gets stored.
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, 'Username must be at least 3 characters')
      .max(20, 'Username must be at most 20 characters')
      .regex(/^[a-z0-9_]+$/, 'Letters, numbers and underscores only'),
    dateOfBirth: z.string().min(1, 'Date of birth is required'),
    gender: z.enum(['male', 'female', 'non-binary', 'prefer-not-to-say'], {
      error: 'Please select a gender',
    }),
    email: z.string().email('Invalid email address'),
    // Length only. Composition rules (an uppercase, a digit) push people towards
    // predictable substitutions without buying much, and they were costing
    // sign-ups here.
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const otpSchema = z.object({
  otp: z
    .string()
    .length(6, 'Enter the 6-digit code')
    .regex(/^\d+$/, 'Code must be numeric'),
});

export const newPasswordSchema = z
  .object({
    // Length only. Composition rules (an uppercase, a digit) push people towards
    // predictable substitutions without buying much, and they were costing
    // sign-ups here.
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

/**
 * Creator sign-up. Mirrors CreateRealmDto on the API — keep the two in step, as
 * this only front-runs the server's own validation.
 */
export const createRealmSchema = z.object({
  name: z
    .string()
    .min(2, 'Your realm name needs at least 2 characters')
    .max(50, 'Realm names are limited to 50 characters'),
  category: z.string().min(1, 'Pick a category for your realm'),
  slug: z
    .string()
    .min(3, 'Handles need at least 3 characters')
    .max(30, 'Handles are limited to 30 characters')
    .regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers and underscores only')
    // Optional: blank means "derive it from the name".
    .or(z.literal('')),
  tagline: z.string().max(120, 'Taglines are limited to 120 characters').or(z.literal('')),
  description: z
    .string()
    .max(1000, 'Descriptions are limited to 1000 characters')
    .or(z.literal('')),
  websiteUrl: z.string().url('Enter a valid URL').or(z.literal('')),
});

export type CreateRealmInput = z.infer<typeof createRealmSchema>;

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type OtpInput = z.infer<typeof otpSchema>;
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
