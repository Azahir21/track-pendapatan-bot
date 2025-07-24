// src/services/ai/tools/utility/GetWeatherTool.ts
import { z } from 'zod';
import { BaseTool } from '../BaseTool';

export class GetWeatherTool extends BaseTool {
  public description = 'Get weather information for a city';
  public parameters = z.object({
    city: z.string().describe('Name of the city'),
  });

  public async execute({ city }: { city: string }): Promise<string> {
    // Mock weather data - replace with actual weather API
    const mockWeather = ['sunny', 'cloudy', 'rainy', 'snowy'];
    const weather = mockWeather[Math.floor(Math.random() * mockWeather.length)];
    const temp = Math.floor(Math.random() * 30) + 10;
    return `The weather in ${city} is currently ${weather} with a temperature of ${temp}°C`;
  }
}
