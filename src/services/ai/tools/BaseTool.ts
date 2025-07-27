import { z } from 'zod';

export interface IToolParameter {
  description: string;
  parameters: z.ZodObject<any>;
  execute: (...args: any[]) => Promise<string>;
}

export abstract class BaseTool implements IToolParameter {
  public abstract description: string;
  public abstract parameters: z.ZodObject<any>;

  public abstract execute(...args: any[]): Promise<string>;

  protected formatCurrency(amount: number): string {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  }

  protected formatDate(date?: Date): string {
    const targetDate = date || new Date();
    return targetDate.toLocaleDateString('id-ID');
  }

  protected getCurrentDateTime(): string {
    return new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
    });
  }
}
