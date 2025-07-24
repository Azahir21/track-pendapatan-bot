// src/services/ai/tools/utility/CalculateMathTool.ts
import { z } from 'zod';
import { BaseTool } from '../BaseTool';

export class CalculateMathTool extends BaseTool {
  public description = 'Perform mathematical calculations';
  public parameters = z.object({
    expression: z
      .string()
      .describe(
        'Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)")',
      ),
  });

  public async execute({
    expression,
  }: {
    expression: string;
  }): Promise<string> {
    try {
      // Simple math evaluation (be careful in production - use a proper math parser)
      const result = Function(`"use strict"; return (${expression})`)();
      return `The result of ${expression} is ${result}`;
    } catch (error) {
      return `Error calculating ${expression}: Invalid expression`;
    }
  }
}
