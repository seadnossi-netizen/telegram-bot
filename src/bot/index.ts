import TelegramBot from "node-telegram-bot-api";
import { registerHandlers } from "./handlers.js";
import { logger } from "./lib/logger.js";

export function startBot(): TelegramBot {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN environment variable is required.");
  }
  const bot = new TelegramBot(token, { polling: true });

  bot.on("polling_error", (error) => {
    logger.error({ error: error.message }, "Telegram polling error");
  });

  bot.on("error", (error) => {
    logger.error({ error: error.message }, "Telegram bot error");
  });

  registerHandlers(bot);

  logger.info("Telegram bot started and polling...");
  return bot;
}
