import bcrypt from 'bcryptjs';

export async function hashPassword(password: string, cost: number): Promise<string> {
  return bcrypt.hash(password, cost);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function validatePasswordPolicy(password: string): boolean {
  const trimmed = password.trim();
  return trimmed.length >= 8 && /[A-Za-zА-Яа-яІіЇїЄєҐґ]/u.test(trimmed) && /\d/u.test(trimmed);
}
