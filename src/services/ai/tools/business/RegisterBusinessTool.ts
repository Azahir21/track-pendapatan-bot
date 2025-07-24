import { z } from 'zod';
import { BaseTool } from '../BaseTool';
import { IManagerService } from '../../../business/ManagerService';
import createDebug from 'debug';

const debug = createDebug('bot:tools:register-business');

export class RegisterBusinessTool extends BaseTool {
  public description =
    'REQUIRED TOOL: Register a new business for the user. Each user can only have one business. Use this when user wants to register, create, or set up their business.';

  public parameters = z.object({
    businessName: z
      .string()
      .min(1)
      .max(100)
      .describe('Name of the garage business to register'),
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
      debug('Registering business for user:', this.telegramUserId);
      debug('Business name:', businessName);

      // Check if user already has a business
      const existingManager = await this.managerService.getManagerByTelegramId(
        this.telegramUserId,
      );

      if (existingManager) {
        return `⚠️ Business Already Registered!\n\nYou already have a business registered: "${existingManager.business_name}"\n\n🔄 Each account can only have ONE business. If you want to change your business name, use the updateBusinessName tool instead.\n\n💡 Current Business: ${existingManager.business_name}\n📅 Registered: ${new Date(existingManager.created_at!).toLocaleDateString('id-ID')}\n\nWhat would you like to do next? You can:\n- Register employees\n- Record daily income\n- View business statistics`;
      }

      // Create new business/manager
      const newManager = await this.managerService.getOrCreateManager(
        this.telegramUserId,
        businessName.trim(),
      );

      if (!newManager) {
        return '❌ Error registering business. Please try again.';
      }

      return `🎉 Business Registered Successfully!\n\n🏢 Business Name: ${businessName}\n👤 Manager ID: ${newManager.id}\n📅 Registered: ${new Date().toLocaleDateString('id-ID')}\n📧 Telegram ID: ${this.telegramUserId}\n\n✅ Your garage business is now set up in TrackPendapatanBot!\n\n🚀 Next Steps:\n1. Register your employees using "register employee [name]"\n2. Start recording daily income for your team\n3. View business statistics and reports\n\n💡 Remember: Each account can only have one business. You can update your business name anytime using the update business name feature.`;
    } catch (error) {
      debug('Error registering business:', error);
      return '❌ Error registering business. Please check your database configuration and try again.';
    }
  }
}
