import { z } from 'zod';
import { BaseTool } from '../BaseTool';
import { WeatherService } from '../../../external/WeatherService';

export class GetWeatherTool extends BaseTool {
  public description =
    'Get current weather information for a city with business context';
  public parameters = z.object({
    city: z.string().describe('Name of the city'),
    includeBusinessInsights: z
      .boolean()
      .optional()
      .describe('Include business impact analysis'),
  });

  constructor(private readonly weatherService: WeatherService) {
    super();
  }

  public async execute({
    city,
    includeBusinessInsights = false,
  }: {
    city: string;
    includeBusinessInsights?: boolean;
  }): Promise<string> {
    try {
      const weatherData = await this.weatherService.getCurrentWeather(city);

      let response = `🌤️ **Weather in ${city}**\n`;
      response += `Temperature: ${weatherData.temperature}°C\n`;
      response += `Condition: ${weatherData.condition} (${weatherData.description})\n`;
      response += `Humidity: ${weatherData.humidity}%\n`;
      response += `Wind Speed: ${weatherData.windSpeed} km/h\n`;

      if (includeBusinessInsights) {
        if (weatherData.condition.toLowerCase().includes('rain')) {
          response += `\n💡 **Business Impact**: Rainy weather may increase brake and electrical service demand while reducing walk-in traffic.`;
        } else if (weatherData.temperature > 32) {
          response += `\n💡 **Business Impact**: Hot weather increases AC service demand. Consider promoting cooling system maintenance.`;
        } else if (weatherData.temperature < 25) {
          response += `\n💡 **Business Impact**: Cooler weather typically increases general vehicle maintenance needs.`;
        }
      }

      return response;
    } catch (error) {
      return `❌ Error getting weather data for ${city}. Please try again.`;
    }
  }
}
