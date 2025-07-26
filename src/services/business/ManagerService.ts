// src/services/business/ManagerService.ts
import { IManagerRepository } from '../../repositories/ManagerRepository';
import { Manager } from '../../models/Manager';
import createDebug from 'debug';

const debug = createDebug('bot:manager-service');

export interface IManagerService {
  getOrCreateManager(
    telegramUserId: string,
    businessName?: string,
  ): Promise<Manager>;
  updateManager(
    managerId: number,
    businessName: string,
  ): Promise<Manager | null>;
  getManagerByTelegramId(telegramUserId: string): Promise<Manager | null>;
  getAllManagers(): Promise<Manager[]>; // <-- Add this line
}

export class ManagerService implements IManagerService {
  constructor(private managerRepository: IManagerRepository) {}

  public async getOrCreateManager(
    telegramUserId: string,
    businessName: string = 'My Garage Business',
  ): Promise<Manager> {
    try {
      // First check if manager already exists
      const existingManager = await this.getManagerByTelegramId(telegramUserId);

      if (existingManager) {
        debug('Manager already exists:', existingManager.id);
        return existingManager;
      }

      // Create new manager (business registration)
      debug('Creating new manager for business:', businessName);
      const manager = new Manager(telegramUserId, businessName.trim());

      const createdManager = await this.managerRepository.create(manager);
      debug('Manager created successfully:', createdManager.id);

      return createdManager;
    } catch (error) {
      debug('Error in getOrCreateManager:', error);
      throw error;
    }
  }

  public async updateManager(
    managerId: number,
    businessName: string,
  ): Promise<Manager | null> {
    debug('Updating manager:', managerId, 'with business name:', businessName);

    const manager = await this.managerRepository.update(managerId, {
      business_name: businessName,
    });

    if (manager) {
      debug('Manager updated successfully');
    } else {
      debug('Manager not found for update');
    }

    return manager;
  }

  public async getManagerByTelegramId(
    telegramUserId: string,
  ): Promise<Manager | null> {
    debug('Getting manager by telegram ID:', telegramUserId);
    return await this.managerRepository.findByTelegramUserId(telegramUserId);
  }

  public async registerBusiness(
    telegramUserId: string,
    businessName: string,
  ): Promise<Manager | null> {
    try {
      // Check if user already has a business (enforce 1 business per account)
      const existingManager = await this.getManagerByTelegramId(telegramUserId);

      if (existingManager) {
        debug('User already has a business:', existingManager.business_name);
        return null; // Return null to indicate business already exists
      }

      // Create new business
      return await this.getOrCreateManager(telegramUserId, businessName);
    } catch (error) {
      debug('Error registering business:', error);
      throw error;
    }
  }

  public async getAllManagers(): Promise<Manager[]> {
    debug('Getting all managers');
    return await this.managerRepository.findAll();
  }
}
