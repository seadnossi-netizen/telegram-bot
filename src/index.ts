import app from "./app.js";
import { logger } from "./lib/logger.js";
import { startBot } from "./bot/index.js";
const port = Number(process.env["PORT"] ?? "8080");
app.listen(port, () => { logger.info({ port }, "Server listening"); });
startBot();
