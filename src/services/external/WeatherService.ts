import createDebug from 'debug';

const debug = createDebug('bot:weather-service');

export interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  description: string;
  icon: string;
}

export interface WeatherInsight {
  period: string;
  averageTemp: number;
  dominantCondition: string;
  rainyDays: number;
  totalDays: number;
  weatherImpact: string;
  businessRecommendation: string;
}

export interface IWeatherService {
  getCurrentWeather(city: string): Promise<WeatherData>;
  getWeatherHistory(
    city: string,
    startDate: Date,
    endDate: Date,
  ): Promise<WeatherData[]>;
  generateWeatherInsights(
    weatherData: WeatherData[],
    businessType: 'garage' | 'general',
  ): WeatherInsight;
}

export class WeatherService implements IWeatherService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.openweathermap.org/data/2.5';
  private readonly historyUrl =
    'https://api.openweathermap.org/data/3.0/onecall/timemachine';
  private readonly isApiAvailable: boolean;

  constructor() {
    this.apiKey = process.env.WEATHER_API_KEY || '';
    this.isApiAvailable = !!this.apiKey;

    if (!this.isApiAvailable) {
      debug(
        'Weather API key not provided. Using intelligent mock data based on Jakarta climate patterns.',
      );
    }
  }

  public async getCurrentWeather(
    city: string = 'Jakarta',
  ): Promise<WeatherData> {
    if (!this.isApiAvailable) {
      return this.getIntelligentMockWeatherData();
    }

    try {
      const url = `${this.baseUrl}/weather?q=${encodeURIComponent(city)}&appid=${this.apiKey}&units=metric`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 401) {
          debug('Invalid API key. Switching to intelligent mock data.');
          return this.getIntelligentMockWeatherData();
        }
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        temperature: Math.round(data.main.temp),
        condition: data.weather[0].main,
        humidity: data.main.humidity,
        windSpeed: data.wind?.speed || 0,
        description: data.weather[0].description,
        icon: data.weather[0].icon,
      };
    } catch (error) {
      debug('Error fetching current weather, using intelligent mock:', error);
      return this.getIntelligentMockWeatherData();
    }
  }

  public async getWeatherHistory(
    city: string = 'Jakarta',
    startDate: Date,
    endDate: Date,
  ): Promise<WeatherData[]> {
    if (!this.isApiAvailable) {
      return this.generateIntelligentWeatherHistory(startDate, endDate);
    }

    try {
      const coords = await this.getCoordinates(city);
      const weatherHistory: WeatherData[] = [];

      const currentDate = new Date(startDate);
      while (currentDate <= endDate && weatherHistory.length < 30) {
        try {
          const timestamp = Math.floor(currentDate.getTime() / 1000);
          const url = `${this.historyUrl}?lat=${coords.lat}&lon=${coords.lon}&dt=${timestamp}&appid=${this.apiKey}&units=metric`;

          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            const weather = data.data[0];

            weatherHistory.push({
              temperature: Math.round(weather.temp),
              condition: weather.weather[0].main,
              humidity: weather.humidity,
              windSpeed: weather.wind_speed,
              description: weather.weather[0].description,
              icon: weather.weather[0].icon,
            });
          } else if (response.status === 401) {
            debug(
              'Invalid API key for historical data. Using intelligent mock.',
            );
            return this.generateIntelligentWeatherHistory(startDate, endDate);
          }
        } catch (error) {
          debug('Error fetching weather for date:', currentDate, error);
        }

        currentDate.setDate(currentDate.getDate() + 1);

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      return weatherHistory.length > 0
        ? weatherHistory
        : this.generateIntelligentWeatherHistory(startDate, endDate);
    } catch (error) {
      debug('Error fetching weather history, using intelligent mock:', error);
      return this.generateIntelligentWeatherHistory(startDate, endDate);
    }
  }

  public generateWeatherInsights(
    weatherData: WeatherData[],
    businessType: 'garage' | 'general' = 'garage',
  ): WeatherInsight {
    if (weatherData.length === 0) {
      return {
        period: 'No data',
        averageTemp: 28,
        dominantCondition: 'Partly Cloudy',
        rainyDays: 0,
        totalDays: 0,
        weatherImpact:
          'Weather analysis based on typical Jakarta climate patterns',
        businessRecommendation:
          'Monitor local weather patterns for optimal service planning',
      };
    }

    const totalDays = weatherData.length;
    const averageTemp =
      weatherData.reduce((sum, w) => sum + w.temperature, 0) / totalDays;

    const conditionCounts = weatherData.reduce(
      (counts, w) => {
        counts[w.condition] = (counts[w.condition] || 0) + 1;
        return counts;
      },
      {} as Record<string, number>,
    );

    const dominantCondition = Object.entries(conditionCounts).sort(
      ([, a], [, b]) => b - a,
    )[0][0];

    const rainyDays = weatherData.filter(
      (w) =>
        w.condition.toLowerCase().includes('rain') ||
        w.condition.toLowerCase().includes('drizzle') ||
        w.condition.toLowerCase().includes('thunderstorm'),
    ).length;

    const { weatherImpact, businessRecommendation } =
      this.generateBusinessInsights(
        averageTemp,
        dominantCondition,
        rainyDays,
        totalDays,
        businessType,
      );

    return {
      period: `${totalDays} days analyzed`,
      averageTemp: Math.round(averageTemp * 10) / 10,
      dominantCondition,
      rainyDays,
      totalDays,
      weatherImpact,
      businessRecommendation,
    };
  }

  private async getCoordinates(
    city: string,
  ): Promise<{ lat: number; lon: number }> {
    try {
      const url = `${this.baseUrl}/weather?q=${encodeURIComponent(city)}&appid=${this.apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Geocoding error: ${response.status}`);
      }

      const data = await response.json();

      return {
        lat: data.coord.lat,
        lon: data.coord.lon,
      };
    } catch (error) {
      debug('Error getting coordinates, using Jakarta default:', error);
      return { lat: -6.2088, lon: 106.8456 };
    }
  }

  private generateBusinessInsights(
    avgTemp: number,
    dominantCondition: string,
    rainyDays: number,
    totalDays: number,
    businessType: 'garage' | 'general',
  ): { weatherImpact: string; businessRecommendation: string } {
    const rainyPercentage = (rainyDays / totalDays) * 100;

    let weatherImpact = '';
    let businessRecommendation = '';

    if (businessType === 'garage') {
      if (avgTemp > 32) {
        weatherImpact +=
          'Hot weather increases AC service demand and may reduce outdoor work efficiency. ';
        businessRecommendation +=
          'Promote AC maintenance services, ensure adequate workshop ventilation, and schedule intensive work during cooler morning hours. ';
      } else if (avgTemp < 25) {
        weatherImpact +=
          'Cooler weather typically increases vehicle usage and maintenance needs. ';
        businessRecommendation +=
          'Focus on general maintenance services, engine check-ups, and heating system inspections. ';
      } else {
        weatherImpact +=
          'Moderate temperatures provide optimal working conditions for most services. ';
        businessRecommendation +=
          'Take advantage of comfortable weather for comprehensive vehicle inspections and exterior work. ';
      }

      if (rainyPercentage > 40) {
        weatherImpact += `Frequent rainfall (${rainyDays}/${totalDays} days) likely reduced walk-in customers but increased urgent repair needs. `;
        businessRecommendation +=
          'Emphasize emergency services, brake maintenance, tire inspections, and electrical system checks. Offer covered waiting areas. ';
      } else if (rainyPercentage > 20) {
        weatherImpact += `Moderate rainfall (${rainyDays}/${totalDays} days) may have caused some service delays but created weatherproofing opportunities. `;
        businessRecommendation +=
          'Promote weather-related maintenance, wiper blade replacements, and undercarriage cleaning services. ';
      } else {
        weatherImpact += `Minimal rainfall (${rainyDays}/${totalDays} days) provided excellent working conditions for all services. `;
        businessRecommendation +=
          'Maximize outdoor services like painting, bodywork, and thorough vehicle cleaning during dry periods. ';
      }

      const currentMonth = new Date().getMonth();
      if (currentMonth >= 11 || currentMonth <= 2) {
        businessRecommendation +=
          'Rainy season strategy: Stock wiper blades, brake pads, and waterproofing supplies. ';
      } else if (currentMonth >= 6 && currentMonth <= 8) {
        businessRecommendation +=
          'Dry season focus: AC servicing, cooling system maintenance, and dust filter replacements. ';
      }
    }

    return { weatherImpact, businessRecommendation };
  }

  private getIntelligentMockWeatherData(): WeatherData {
    const now = new Date();
    const month = now.getMonth();
    const hour = now.getHours();

    let baseTemp = 28;
    let conditions = ['Clear', 'Partly Cloudy', 'Cloudy'];
    let descriptions = ['clear sky', 'partly cloudy', 'overcast clouds'];

    if (month >= 11 || month <= 2) {
      baseTemp = 26;
      conditions = ['Rain', 'Thunderstorm', 'Cloudy', 'Drizzle'];
      descriptions = [
        'moderate rain',
        'thunderstorm with rain',
        'overcast clouds',
        'light drizzle',
      ];
    } else if (month >= 6 && month <= 8) {
      baseTemp = 30;
      conditions = ['Clear', 'Sunny', 'Partly Cloudy'];
      descriptions = ['clear sky', 'sunny', 'few clouds'];
    }

    if (hour >= 6 && hour <= 10) {
      baseTemp -= 2;
    } else if (hour >= 12 && hour <= 16) {
      baseTemp += 4;
    } else if (hour >= 18 && hour <= 22) {
      baseTemp += 1;
    } else {
      baseTemp -= 3;
    }

    const randomIndex = Math.floor(Math.random() * conditions.length);

    return {
      temperature: Math.max(
        22,
        Math.min(36, baseTemp + Math.floor(Math.random() * 4) - 2),
      ),
      condition: conditions[randomIndex],
      humidity: 70 + Math.floor(Math.random() * 20),
      windSpeed: 5 + Math.floor(Math.random() * 10),
      description: descriptions[randomIndex],
      icon: this.getWeatherIcon(conditions[randomIndex]),
    };
  }

  private generateIntelligentWeatherHistory(
    startDate: Date,
    endDate: Date,
  ): WeatherData[] {
    const weatherHistory: WeatherData[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const originalDate = new Date();
      const tempDate = new Date(currentDate);

      new Date().setMonth(tempDate.getMonth());
      new Date().setDate(tempDate.getDate());

      weatherHistory.push(this.getIntelligentMockWeatherData());
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return weatherHistory;
  }

  private getWeatherIcon(condition: string): string {
    const iconMap: Record<string, string> = {
      Clear: '01d',
      Sunny: '01d',
      'Partly Cloudy': '02d',
      Cloudy: '03d',
      Overcast: '04d',
      Rain: '10d',
      Drizzle: '09d',
      Thunderstorm: '11d',
      Fog: '50d',
    };

    return iconMap[condition] || '02d';
  }
}
