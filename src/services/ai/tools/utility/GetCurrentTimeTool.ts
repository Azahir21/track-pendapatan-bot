// src/services/ai/tools/utility/GetCurrentTimeTool.ts
import { z } from 'zod';
import { BaseTool } from '../BaseTool';

export class GetCurrentTimeTool extends BaseTool {
  public description = 'Get the current date and time';
  public parameters = z.object({});

  public async execute(): Promise<string> {
    return this.getCurrentDateTime();
  }
}
