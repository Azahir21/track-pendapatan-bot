import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import createDebug from 'debug';
import { z } from 'zod';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const debug = createDebug('bot:llm');

// In-memory session storage (for simple use cases)
// For production, consider using Redis or a database
const userSessions = new Map<
  string,
  Array<{ role: 'user' | 'assistant'; content: string }>
>();

// Aiven PostgreSQL connection configuration with TrackPendapatanBot schema
const createPool = () => {
  // Ensure all environment variables are strings and properly formatted
  const config = {
    user: process.env.AIVEN_USER?.toString(),
    password: process.env.AIVEN_PASSWORD?.toString(),
    host: process.env.AIVEN_HOST?.toString(),
    port: parseInt(process.env.AIVEN_PORT || '5432'),
    database: process.env.AIVEN_DATABASE?.toString(),
    ssl: false as any, // Will be configured below
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 10,
    // Set default schema
    options: '--search_path=TrackPendapatanBot,public',
  };

  // Configure SSL based on environment
  if (process.env.NODE_ENV === 'production' || process.env.AIVEN_CA_CERT) {
    // Production/Aiven SSL configuration
    config.ssl = {
      rejectUnauthorized: true,
      ca: process.env.AIVEN_CA_CERT?.toString() || undefined,
    };
  } else {
    // Development - try without SSL first, then with SSL if needed
    config.ssl = false;
  }

  debug('Creating PostgreSQL pool with config:', {
    user: config.user,
    host: config.host,
    port: config.port,
    database: config.database,
    ssl: config.ssl ? 'enabled' : 'disabled',
    schema: 'TrackPendapatanBot',
  });

  return new Pool(config);
};

const pool = createPool();

// Test database connection with retry logic
const testConnection = async (retryWithSsl = true) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT VERSION()');
    debug('Database connected successfully:', result.rows[0].version);
    client.release();
    return true;
  } catch (error: any) {
    debug('Database connection failed:', error.message);

    // If SSL error and we haven't tried with SSL yet, retry with SSL
    if (retryWithSsl && error.message.includes('SSL') && !pool.options.ssl) {
      debug('Retrying connection with SSL enabled...');

      // Close current pool
      await pool.end();

      // Create new pool with SSL
      const sslConfig = {
        user: process.env.AIVEN_USER?.toString() || '',
        password: process.env.AIVEN_PASSWORD?.toString() || '',
        host: process.env.AIVEN_HOST?.toString() || '',
        port: parseInt(process.env.AIVEN_PORT || '5432'),
        database: process.env.AIVEN_DATABASE?.toString() || '',
        ssl: {
          rejectUnauthorized: false, // More permissive for development
        },
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 10,
        options: '--search_path=TrackPendapatanBot,public',
      };

      const newPool = new Pool(sslConfig);

      try {
        const client = await newPool.connect();
        const result = await client.query('SELECT VERSION()');
        debug(
          'Database connected successfully with SSL:',
          result.rows[0].version,
        );
        client.release();

        // Replace the global pool
        Object.assign(pool, newPool);
        return true;
      } catch (sslError: any) {
        debug('SSL connection also failed:', sslError.message);
        await newPool.end();
        return false;
      }
    }

    return false;
  }
};

// Initialize database schema and tables
const initializeDatabase = async () => {
  try {
    // Create schema if it doesn't exist
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "TrackPendapatanBot"`);
    debug('Schema TrackPendapatanBot ensured');

    // Set search path for this session
    await pool.query(`SET search_path TO "TrackPendapatanBot", public`);

    // Create users table in the schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "TrackPendapatanBot".users (
        id SERIAL PRIMARY KEY,
        telegram_user_id VARCHAR(255) UNIQUE NOT NULL,
        employee_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create income_entries table in the schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "TrackPendapatanBot".income_entries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES "TrackPendapatanBot".users(id) ON DELETE CASCADE,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        service_type VARCHAR(255) NOT NULL,
        vehicle_type VARCHAR(255) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    debug(
      'Database tables initialized successfully in TrackPendapatanBot schema',
    );
  } catch (error) {
    debug('Error initializing database:', error);
  }
};

// Initialize database on startup with delay
const initializeApp = async () => {
  debug('Initializing database connection...');
  const connected = await testConnection();

  if (connected) {
    await initializeDatabase();
  } else {
    debug(
      'Failed to connect to database. Please check your Aiven credentials.',
    );
  }
};

// Initialize with a slight delay to ensure environment variables are loaded
setTimeout(initializeApp, 1000);

// Helper function to get or create user
const getOrCreateUser = async (
  telegramUserId: string,
  employeeName?: string,
) => {
  try {
    // First, try to get existing user
    const userResult = await pool.query(
      'SELECT * FROM "TrackPendapatanBot".users WHERE telegram_user_id = $1',
      [telegramUserId],
    );

    if (userResult.rows.length > 0) {
      return userResult.rows[0];
    }

    // If user doesn't exist and no employee name provided, return null
    if (!employeeName) {
      return null;
    }

    // Create new user
    const newUserResult = await pool.query(
      'INSERT INTO "TrackPendapatanBot".users (telegram_user_id, employee_name) VALUES ($1, $2) RETURNING *',
      [telegramUserId, employeeName],
    );

    return newUserResult.rows[0];
  } catch (error) {
    debug('Error in getOrCreateUser:', error);
    throw error;
  }
};

export const callLLMWithContext = async (
  userId: string,
  message: string,
): Promise<string> => {
  debug('Calling LLM with context for user:', userId);

  try {
    // Get or initialize user session
    let conversation = userSessions.get(userId) || [];
    debug('Current conversation:', conversation);

    // Add user message to conversation history (only if message is not empty)
    if (message && message.trim()) {
      conversation.push({ role: 'user', content: message.trim() });
    }

    // Keep only last 10 messages to avoid token limits
    if (conversation.length > 10) {
      conversation = conversation.slice(-10);
    }

    // Filter out empty messages and ensure all messages have content
    const validMessages = conversation.filter(
      (msg) => msg.content && msg.content.trim().length > 0,
    );

    // Ensure we have at least one message
    if (validMessages.length === 0) {
      validMessages.push({ role: 'user', content: 'Hello' });
    }

    const { text, toolCalls } = await generateText({
      model: google('gemini-1.5-flash'),
      system:
        'You are a helpful assistant for a garage business specializing in car and motorcycle services. You can help with income tracking, user registration, and recording daily income in a PostgreSQL database using the TrackPendapatanBot schema. Always be professional and helpful when assisting with business operations.',
      messages: validMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      tools: {
        getCurrentTime: {
          description: 'Get the current date and time',
          parameters: z.object({}),
          execute: async () => {
            return new Date().toLocaleString('id-ID', {
              timeZone: 'Asia/Jakarta',
            });
          },
        },
        calculateMath: {
          description: 'Perform mathematical calculations',
          parameters: z.object({
            expression: z
              .string()
              .describe(
                'Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)")',
              ),
          }),
          execute: async ({ expression }: { expression: string }) => {
            try {
              // Simple math evaluation (be careful in production - use a proper math parser)
              const result = Function(`"use strict"; return (${expression})`)();
              return `The result of ${expression} is ${result}`;
            } catch (error) {
              return `Error calculating ${expression}: Invalid expression`;
            }
          },
        },
        getWeather: {
          description: 'Get weather information for a city',
          parameters: z.object({
            city: z.string().describe('Name of the city'),
          }),
          execute: async ({ city }: { city: string }) => {
            // Mock weather data - replace with actual weather API
            const mockWeather = ['sunny', 'cloudy', 'rainy', 'snowy'];
            const weather =
              mockWeather[Math.floor(Math.random() * mockWeather.length)];
            const temp = Math.floor(Math.random() * 30) + 10;
            return `The weather in ${city} is currently ${weather} with a temperature of ${temp}°C`;
          },
        },
        registerEmployee: {
          description:
            'Register a new employee for income tracking in the garage business',
          parameters: z.object({
            employeeName: z
              .string()
              .describe('Name of the employee who will use this system'),
          }),
          execute: async ({ employeeName }: { employeeName: string }) => {
            try {
              debug('Attempting to register employee:', employeeName);

              // Check if user already exists
              const existingUser = await getOrCreateUser(userId);
              if (existingUser) {
                return `You are already registered as employee: ${existingUser.employee_name}. You can start recording income entries for your garage services.`;
              }

              // Create new user
              const newUser = await getOrCreateUser(userId, employeeName);
              if (!newUser) {
                return 'Error registering employee. Please try again.';
              }

              return `✅ Employee registered successfully in TrackPendapatanBot!\n\nName: ${employeeName}\nUser ID: ${newUser.id}\nSchema: TrackPendapatanBot\n\nYou can now start recording daily income entries for your garage business using the recordIncome tool.`;
            } catch (error) {
              debug('Error registering employee:', error);
              return 'Error registering employee. Please check your database configuration and try again.';
            }
          },
        },
        recordIncome: {
          description:
            'Record daily income entry for garage services in the TrackPendapatanBot database',
          parameters: z.object({
            serviceType: z
              .string()
              .describe(
                'Type of service (e.g., Oil Change, Brake Repair, Engine Service, Tire Change, Washing)',
              ),
            vehicleType: z
              .string()
              .describe(
                'Type of vehicle (e.g., Car, Motorcycle, Truck, Scooter)',
              ),
            amount: z.number().describe('Income amount in IDR'),
            notes: z
              .string()
              .optional()
              .describe('Additional notes about the service'),
          }),
          execute: async ({
            serviceType,
            vehicleType,
            amount,
            notes,
          }: {
            serviceType: string;
            vehicleType: string;
            amount: number;
            notes?: string;
          }) => {
            try {
              // Get user from database
              const user = await getOrCreateUser(userId);
              if (!user) {
                return 'You need to register as an employee first. Use the registerEmployee tool with your name.';
              }

              const currentDate = new Date().toLocaleDateString('id-ID');

              // Insert new income entry into TrackPendapatanBot schema
              const result = await pool.query(
                `INSERT INTO "TrackPendapatanBot".income_entries (user_id, service_type, vehicle_type, amount, notes) 
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [user.id, serviceType, vehicleType, amount, notes || ''],
              );

              const entry = result.rows[0];

              return `✅ Income recorded successfully in TrackPendapatanBot!\n\nID: ${entry.id}\nDate: ${currentDate}\nService: ${serviceType}\nVehicle: ${vehicleType}\nAmount: Rp ${amount.toLocaleString('id-ID')}\nEmployee: ${user.employee_name}\nNotes: ${notes || 'None'}\n\n💰 Keep tracking your garage business income!`;
            } catch (error) {
              debug('Error recording income:', error);
              return 'Error recording income. Please try again.';
            }
          },
        },
        getTodayIncome: {
          description:
            "Get today's total income from the TrackPendapatanBot database",
          parameters: z.object({}),
          execute: async () => {
            try {
              const user = await getOrCreateUser(userId);
              if (!user) {
                return 'You need to register as an employee first. Use the registerEmployee tool with your name.';
              }

              const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

              // Get today's income entries from TrackPendapatanBot schema
              const result = await pool.query(
                `SELECT COUNT(*) as entry_count, COALESCE(SUM(amount), 0) as total_amount 
                 FROM "TrackPendapatanBot".income_entries 
                 WHERE user_id = $1 AND date = $2`,
                [user.id, today],
              );

              const { entry_count, total_amount } = result.rows[0];
              const todayFormatted = new Date().toLocaleDateString('id-ID');

              return `📊 Today's Income Summary (${todayFormatted})\n🏪 TrackPendapatanBot - Garage Business\n\nEmployee: ${user.employee_name}\nTotal Entries: ${entry_count}\nTotal Income: Rp ${parseFloat(total_amount).toLocaleString('id-ID')}\n\n💡 Keep up the great work!`;
            } catch (error) {
              debug('Error getting today income:', error);
              return "Error retrieving today's income. Please try again.";
            }
          },
        },
        getMonthlyIncome: {
          description:
            'Get monthly total income from the TrackPendapatanBot database',
          parameters: z.object({
            month: z
              .number()
              .min(1)
              .max(12)
              .optional()
              .describe('Month number (1-12), defaults to current month'),
            year: z
              .number()
              .optional()
              .describe('Year, defaults to current year'),
          }),
          execute: async ({
            month,
            year,
          }: {
            month?: number;
            year?: number;
          }) => {
            try {
              const user = await getOrCreateUser(userId);
              if (!user) {
                return 'You need to register as an employee first. Use the registerEmployee tool with your name.';
              }

              const currentDate = new Date();
              const targetMonth = month || currentDate.getMonth() + 1;
              const targetYear = year || currentDate.getFullYear();

              // Get monthly income entries from TrackPendapatanBot schema
              const result = await pool.query(
                `SELECT COUNT(*) as entry_count, COALESCE(SUM(amount), 0) as total_amount 
                 FROM "TrackPendapatanBot".income_entries 
                 WHERE user_id = $1 
                 AND EXTRACT(MONTH FROM date) = $2 
                 AND EXTRACT(YEAR FROM date) = $3`,
                [user.id, targetMonth, targetYear],
              );

              const { entry_count, total_amount } = result.rows[0];

              const monthNames = [
                'January',
                'February',
                'March',
                'April',
                'May',
                'June',
                'July',
                'August',
                'September',
                'October',
                'November',
                'December',
              ];

              return `📊 Monthly Income Summary\n🏪 TrackPendapatanBot - Garage Business\n\nEmployee: ${user.employee_name}\nMonth: ${monthNames[targetMonth - 1]} ${targetYear}\nTotal Entries: ${entry_count}\nTotal Income: Rp ${parseFloat(total_amount).toLocaleString('id-ID')}\n\n📈 Track your business growth!`;
            } catch (error) {
              debug('Error getting monthly income:', error);
              return 'Error retrieving monthly income. Please try again.';
            }
          },
        },
        getIncomeHistory: {
          description:
            'Get recent income history from the TrackPendapatanBot database',
          parameters: z.object({
            limit: z
              .number()
              .min(1)
              .max(50)
              .optional()
              .describe('Number of recent entries to retrieve (default: 10)'),
          }),
          execute: async ({ limit = 10 }: { limit?: number }) => {
            try {
              const user = await getOrCreateUser(userId);
              if (!user) {
                return 'You need to register as an employee first. Use the registerEmployee tool with your name.';
              }

              // Get recent income entries from TrackPendapatanBot schema
              const result = await pool.query(
                `SELECT * FROM "TrackPendapatanBot".income_entries 
                 WHERE user_id = $1 
                 ORDER BY date DESC, created_at DESC 
                 LIMIT $2`,
                [user.id, limit],
              );

              if (result.rows.length === 0) {
                return 'No income entries found in TrackPendapatanBot. Start recording your daily garage income!';
              }

              let historyText = `📋 Recent Income History (Last ${result.rows.length} entries)\n🏪 TrackPendapatanBot - Garage Business\n\nEmployee: ${user.employee_name}\n\n`;

              result.rows.forEach((entry, index) => {
                const date = new Date(entry.date).toLocaleDateString('id-ID');
                historyText += `${index + 1}. ${date}\n`;
                historyText += `   🔧 Service: ${entry.service_type}\n`;
                historyText += `   🚗 Vehicle: ${entry.vehicle_type}\n`;
                historyText += `   💰 Amount: Rp ${parseFloat(entry.amount).toLocaleString('id-ID')}\n`;
                if (entry.notes) {
                  historyText += `   📝 Notes: ${entry.notes}\n`;
                }
                historyText += '\n';
              });

              const totalAmount = result.rows.reduce(
                (sum, entry) => sum + parseFloat(entry.amount),
                0,
              );
              historyText += `💵 Total Amount: Rp ${totalAmount.toLocaleString('id-ID')}`;

              return historyText;
            } catch (error) {
              debug('Error getting income history:', error);
              return 'Error retrieving income history. Please try again.';
            }
          },
        },
        getBusinessStats: {
          description:
            'Get comprehensive business statistics from TrackPendapatanBot',
          parameters: z.object({}),
          execute: async () => {
            try {
              const user = await getOrCreateUser(userId);
              if (!user) {
                return 'You need to register as an employee first. Use the registerEmployee tool with your name.';
              }

              // Get various statistics
              const todayResult = await pool.query(
                `SELECT COUNT(*) as today_count, COALESCE(SUM(amount), 0) as today_total
                 FROM "TrackPendapatanBot".income_entries 
                 WHERE user_id = $1 AND date = CURRENT_DATE`,
                [user.id],
              );

              const monthResult = await pool.query(
                `SELECT COUNT(*) as month_count, COALESCE(SUM(amount), 0) as month_total
                 FROM "TrackPendapatanBot".income_entries 
                 WHERE user_id = $1 
                 AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM CURRENT_DATE)
                 AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
                [user.id],
              );

              const serviceStats = await pool.query(
                `SELECT service_type, COUNT(*) as count, SUM(amount) as total
                 FROM "TrackPendapatanBot".income_entries 
                 WHERE user_id = $1 
                 GROUP BY service_type 
                 ORDER BY total DESC LIMIT 5`,
                [user.id],
              );

              let statsText = `📊 Business Statistics - TrackPendapatanBot\n🏪 Garage Business Dashboard\n\nEmployee: ${user.employee_name}\n\n`;

              statsText += `📅 Today:\n`;
              statsText += `   Transactions: ${todayResult.rows[0].today_count}\n`;
              statsText += `   Revenue: Rp ${parseFloat(todayResult.rows[0].today_total).toLocaleString('id-ID')}\n\n`;

              statsText += `📆 This Month:\n`;
              statsText += `   Transactions: ${monthResult.rows[0].month_count}\n`;
              statsText += `   Revenue: Rp ${parseFloat(monthResult.rows[0].month_total).toLocaleString('id-ID')}\n\n`;

              if (serviceStats.rows.length > 0) {
                statsText += `🔧 Top Services:\n`;
                serviceStats.rows.forEach((service, index) => {
                  statsText += `   ${index + 1}. ${service.service_type}: ${service.count} jobs, Rp ${parseFloat(service.total).toLocaleString('id-ID')}\n`;
                });
              }

              return statsText;
            } catch (error) {
              debug('Error getting business stats:', error);
              return 'Error retrieving business statistics. Please try again.';
            }
          },
        },
      },
      maxTokens: 1000,
      temperature: 0.7,
    });

    let response =
      text ||
      'I received your message. How can I help you with your TrackPendapatanBot garage business today?';

    // Ensure response is not empty
    if (!response || response.trim().length === 0) {
      response =
        'I received your message. How can I help you with your TrackPendapatanBot garage business today?';
    }

    // The tools are automatically executed by the AI SDK, so we just use the response
    if (toolCalls && toolCalls.length > 0) {
      debug('Tool calls detected and executed:', toolCalls);
    }

    // Add assistant response to conversation history (only if not empty)
    if (response && response.trim()) {
      conversation.push({ role: 'assistant', content: response.trim() });
    }

    // Update session with validated conversation
    userSessions.set(
      userId,
      conversation.filter(
        (msg) => msg.content && msg.content.trim().length > 0,
      ),
    );

    return response;
  } catch (error) {
    debug('LLM API error:', error);
    // Return a fallback response instead of throwing
    return 'I apologize, but I encountered an error with TrackPendapatanBot. Please try again or rephrase your message.';
  }
};

export const clearUserSession = (userId: string): void => {
  userSessions.delete(userId);
  debug('Cleared session for user:', userId);
};

// Graceful shutdown
process.on('SIGINT', async () => {
  debug('Closing TrackPendapatanBot database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  debug('Closing TrackPendapatanBot database pool...');
  await pool.end();
  process.exit(0);
});
