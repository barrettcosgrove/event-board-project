import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export interface IPasswordHasher {
  hash(password: string): string;
  verify(password: string, storedHash: string): boolean;
}

class ScryptPasswordHasher implements IPasswordHasher {
  hash(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
  }

  verify(password: string, storedHash: string): boolean {
    const [salt, expectedHash] = storedHash.split(":");

    if (!salt || !expectedHash) {
      return false;
    }

    const derivedHash = scryptSync(password, salt, 64).toString("hex");
    return timingSafeEqual(Buffer.from(derivedHash, "hex"), Buffer.from(expectedHash, "hex"));
  }
}

export function CreatePasswordHasher(): IPasswordHasher {
  return new ScryptPasswordHasher();
}
