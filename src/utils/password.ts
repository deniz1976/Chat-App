import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const BCRYPT_ROUNDS = 10;

let dummyHash: Promise<string> | null = null;

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, BCRYPT_ROUNDS);

export const verifyPassword = (password: string, hash: string): Promise<boolean> => bcrypt.compare(password, hash);

export const simulatePasswordVerification = async (password: string): Promise<void> => {
  dummyHash ??= hashPassword(randomUUID());
  await bcrypt.compare(password, await dummyHash);
};
