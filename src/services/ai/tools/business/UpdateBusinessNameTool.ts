import { z } from 'zod';
import { BaseTool } from '../BaseTool';
import { IManagerService } from '../../../business/ManagerService';
import createDebug from 'debug';

const debug = createDebug('bot:tools:update-business-name');

export class UpdateBusinessNameTool extends BaseTool {
  public description = 'Update the business name for the garage business';
  public parameters = z.object({
    businessName: z.string().describe('New name for the garage business'),
  });

  constructor(
    private readonly managerService: IManagerService,
    private readonly telegramUserId: string,
  ) {
    super();
  }

  public async execute({
    businessName,
  }: {
    businessName: string;
  }): Promise<string> {
    try {
      debug('Updating business name to:', businessName);

      // Get or create manager
      const manager = await this.managerService.getOrCreateManager(
        this.telegramUserId,
        businessName,
      );

      // If manager already exists, update the business name
      if (manager.business_name !== businessName) {
        const updatedManager = await this.managerService.updateManager(
          manager.id!,
          businessName,
        );

        if (updatedManager) {
          return `Business name updated successfully from "${manager.business_name}" to "${businessName}". Your garage business is now registered as "${businessName}" in the TrackPendapatanBot system.`;
        } else {
          return `Error updating business name. Please try again.`;
        }
      }

      return `Your garage business is already named "${businessName}". No changes needed.`;
    } catch (error) {
      debug('Error updating business name:', error);
      return 'Error updating business name. Please check your database configuration and try again.';
    }
  }
}
