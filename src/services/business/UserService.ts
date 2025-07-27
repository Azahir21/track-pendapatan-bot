import { User } from '../../models/User';
import { IUserRepository } from '../../repositories/UserRepository';
import createDebug from 'debug';

const debug = createDebug('bot:user-service');

export interface IUserService {
  getOrCreateUser(
    telegramUserId: string,
    employeeName?: string,
  ): Promise<User | null>;
  getUserById(id: number): Promise<User | null>;
}

export class UserService implements IUserService {
  constructor(private userRepository: IUserRepository) {}

  public async getOrCreateUser(
    telegramUserId: string,
    employeeName?: string,
  ): Promise<User | null> {
    try {
      debug('Getting or creating user:', telegramUserId);

      const existingUser =
        await this.userRepository.findByTelegramId(telegramUserId);
      if (existingUser) {
        debug('User found:', existingUser.employee_name);
        return existingUser;
      }

      if (!employeeName) {
        debug('User not found and no employee name provided');
        return null;
      }

      const newUser = new User(telegramUserId, employeeName);
      const createdUser = await this.userRepository.create(newUser);
      debug('User created:', createdUser.employee_name);

      return createdUser;
    } catch (error) {
      debug('Error in getOrCreateUser:', error);
      throw error;
    }
  }

  public async getUserById(id: number): Promise<User | null> {
    try {
      return await this.userRepository.findById(id);
    } catch (error) {
      debug('Error getting user by id:', error);
      throw error;
    }
  }
}
