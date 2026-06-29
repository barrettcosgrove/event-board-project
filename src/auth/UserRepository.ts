import type { Result } from "../lib/result";
import type { AuthError } from "./errors";
import type { IUserRecord } from "./User";

export interface IUserRepository {
  findByEmail(email: string): Promise<Result<IUserRecord | null, AuthError>>;
  findById(id: string): Promise<Result<IUserRecord | null, AuthError>>;
  listUsers(): Promise<Result<IUserRecord[], AuthError>>;
  createUser(user: IUserRecord): Promise<Result<IUserRecord, AuthError>>;
  deleteUser(id: string): Promise<Result<boolean, AuthError>>;
}
