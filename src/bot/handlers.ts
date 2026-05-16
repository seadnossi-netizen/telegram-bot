import TelegramBot from "node-telegram-bot-api";
import { v4 as uuidv4 } from "uuid";
import {
  loadDB,
  saveDB,
  getUser,
  isAdmin,
  getStockCount,
  getTotalStockCount,
  getTotalSold,
  type Category,
  type Product,
} from "./database.js";
import {
  getState,
  setState,
  clearState,
  isLoggedIn,
  login,
  logout,
} from "./states.js";
import {
  mainMenuKeyboard,
  cancelKeyboard,
  categoryInlineKeyboard,
  productInlineKeyboard,
  manageInlineKeyboard,
  adminCategoryKeyboard,
  adminProductKeyboard,
  confirmBuyKeyboard,
} from "./keyboards.js";

const OWNER_ID = 7294172618;

function slugify(name: string): string {
  return (
    name.toLowerCase().replace(/[^a-z0-9]/g, "_").substring(0, 20) +
    "_" +
    uuidv4().substring(0, 6)
  );
}

function sendLoginPrompt(bot: TelegramBot, chatId: number): void {
  setState(chatId, "waiting_for_password");
  bot.sendMessage(
    chatId,
    `🔐 <b>Welcome!</b>\n\nPlease enter the password to access the panel:`,
    {
      parse_mode: "HTML",
      reply_markup: { remove_keyboard: true },
    }
  );
}

export function registerHandlers(bot: TelegramBot): void {

  // ── /start ──────────────────────────────────────────────────────────────
  bot.onText(/\/start/, (msg) => {
    const userId = msg.from!.id;
    const chatId = msg.chat.id;
    const db = loadDB();

    // Save basic user info even before login
    if (!db.users[String(userId)]) {
      getUser(db, userId);
    }
    const u = db.users[String(userId)]!;
    if (!u.username && msg.from?.username) {
      u.username = msg.from.username;
      u.firstName = msg.from.first_name;
      saveDB(db);
    }

    const admin = isAdmin(db, userId);

    // Owner and admins skip login entirely
    if (admin) {
      login(userId);
      clearState(userId);
      bot.sendMessage(chatId, `👋 Hello, welcome to panel!`, {
        reply_markup: mainMenuKeyboard(true),
      });
      return;
    }

    if (isLoggedIn(userId)) {
      clearState(userId);
      bot.sendMessage(chatId, `👋 Hello, welcome to panel!`, {
        reply_markup: mainMenuKeyboard(false),
      });
      return;
    }

    sendLoginPrompt(bot, chatId);
  });

  // ── /addbalance ──────────────────────────────────────────────────────────
  bot.onText(/\/addbalance (.+)/, (msg, match) => {
    const userId = msg.from!.id;
    const chatId = msg.chat.id;
    const db = loadDB();
    if (!isAdmin(db, userId)) return;
    const parts = (match![1] || "").trim().split(" ");
    if (parts.length < 2) {
      bot.sendMessage(chatId, "Usage: /addbalance &lt;userId&gt; &lt;amount&gt;", { parse_mode: "HTML" });
      return;
    }
    const targetId = parseInt(parts[0]!);
    const amount = parseFloat(parts[1]!);
    if (isNaN(targetId) || isNaN(amount) || amount <= 0) {
      bot.sendMessage(chatId, "❌ Invalid userId or amount.");
      return;
    }
    const user = getUser(db, targetId);
    user.balance += amount;
    db.users[String(targetId)] = user;
    saveDB(db);
    bot.sendMessage(
      chatId,
      `✅ Added <b>$${amount}</b> to user <code>${targetId}</code>.\nNew balance: <b>$${user.balance}</b>`,
      { parse_mode: "HTML" }
    );
    bot
      .sendMessage(
        targetId,
        `💳 Your balance has been topped up by <b>$${amount}</b>!\nNew balance: <b>$${user.balance}</b>`,
        { parse_mode: "HTML" }
      )
      .catch(() => {});
  });

  // ── /removebalance ───────────────────────────────────────────────────────
  bot.onText(/\/removebalance (.+)/, (msg, match) => {
    const userId = msg.from!.id;
    const chatId = msg.chat.id;
    const db = loadDB();
    if (!isAdmin(db, userId)) return;
    const parts = (match![1] || "").trim().split(" ");
    if (parts.length < 2) {
      bot.sendMessage(chatId, "Usage: /removebalance &lt;userId&gt; &lt;amount&gt;", { parse_mode: "HTML" });
      return;
    }
    const targetId = parseInt(parts[0]!);
    const amount = parseFloat(parts[1]!);
    if (isNaN(targetId) || isNaN(amount) || amount <= 0) {
      bot.sendMessage(chatId, "❌ Invalid userId or amount.");
      return;
    }
    const user = getUser(db, targetId);
    user.balance = Math.max(0, user.balance - amount);
    db.users[String(targetId)] = user;
    saveDB(db);
    bot.sendMessage(
      chatId,
      `✅ Removed <b>$${amount}</b> from user <code>${targetId}</code>.\nNew balance: <b>$${user.balance}</b>`,
      { parse_mode: "HTML" }
    );
  });

  // ── /setpassword ─────────────────────────────────────────────────────────
  bot.onText(/\/setpassword/, (msg) => {
    const userId = msg.from!.id;
    const chatId = msg.chat.id;
    const db = loadDB();
    if (!isAdmin(db, userId)) return;
    setState(userId, "admin_set_password");
    bot.sendMessage(chatId, "🔑 Enter the new login password:", {
      reply_markup: cancelKeyboard(),
    });
  });

  // ── /addadmin ────────────────────────────────────────────────────────────
  bot.onText(/\/addadmin (.+)/, (msg, match) => {
    const userId = msg.from!.id;
    const chatId = msg.chat.id;
    if (userId !== OWNER_ID) return;
    const targetId = parseInt((match![1] || "").trim());
    if (isNaN(targetId)) {
      bot.sendMessage(chatId, "Usage: /addadmin &lt;userId&gt;", { parse_mode: "HTML" });
      return;
    }
    const db = loadDB();
    if (!db.admins.includes(targetId)) {
      db.admins.push(targetId);
      saveDB(db);
    }
    bot.sendMessage(chatId, `✅ User <code>${targetId}</code> is now an admin.`, {
      parse_mode: "HTML",
    });
  });

  // ── /removeadmin ─────────────────────────────────────────────────────────
  bot.onText(/\/removeadmin (.+)/, (msg, match) => {
    const userId = msg.from!.id;
    const chatId = msg.chat.id;
    if (userId !== OWNER_ID) return;
    const targetId = parseInt((match![1] || "").trim());
    if (isNaN(targetId) || targetId === OWNER_ID) {
      bot.sendMessage(chatId, "❌ Cannot remove owner or invalid ID.");
      return;
    }
    const db = loadDB();
    db.admins = db.admins.filter((id) => id !== targetId);
    saveDB(db);
    bot.sendMessage(chatId, `✅ User <code>${targetId}</code> removed from admins.`, {
      parse_mode: "HTML",
    });
  });

  // ── /broadcast ───────────────────────────────────────────────────────────
  bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    const userId = msg.from!.id;
    const chatId = msg.chat.id;
    const db = loadDB();
    if (!isAdmin(db, userId)) return;
    const text = (match![1] || "").trim();
    const userIds = Object.keys(db.users).map(Number);
    let sent = 0;
    let failed = 0;
    for (const uid of userIds) {
      try {
        await bot.sendMessage(uid, `📢 <b>Announcement:</b>\n\n${text}`, {
          parse_mode: "HTML",
        });
        sent++;
      } catch {
        failed++;
      }
    }
    bot.sendMessage(
      chatId,
      `📢 Broadcast sent!\n✅ Delivered: <b>${sent}</b>\n❌ Failed: <b>${failed}</b>`,
      { parse_mode: "HTML" }
    );
  });

  // ── /users ───────────────────────────────────────────────────────────────
  bot.onText(/\/users/, (msg) => {
    const userId = msg.from!.id;
    const chatId = msg.chat.id;
    const db = loadDB();
    if (!isAdmin(db, userId)) return;
    const users = Object.values(db.users);
    let text = `👥 <b>Users (${users.length})</b>\n\n`;
    for (const u of users.slice(0, 20)) {
      text += `• <code>${u.userId}</code> ${u.firstName || ""} — $${u.balance} — ${u.purchases.length} purchases\n`;
    }
    if (users.length > 20) text += `\n...and ${users.length - 20} more`;
    bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  });

  // ── /help ────────────────────────────────────────────────────────────────
  bot.onText(/\/help/, (msg) => {
    const userId = msg.from!.id;
    const chatId = msg.chat.id;
    const db = loadDB();
    const admin = isAdmin(db, userId);
    let text = `ℹ️ <b>Help</b>\n\n/start — Open main menu\n/help — Show this message\n`;
    if (admin) {
      text += `\n<b>Admin commands:</b>\n`;
      text += `/setpassword — Change login password\n`;
      text += `/addbalance &lt;userId&gt; &lt;amount&gt; — Add balance\n`;
      text += `/removebalance &lt;userId&gt; &lt;amount&gt; — Remove balance\n`;
      text += `/broadcast &lt;message&gt; — Message all users\n`;
      text += `/users — List all users\n`;
      text += `/addadmin &lt;userId&gt; — Add admin (owner only)\n`;
      text += `/removeadmin &lt;userId&gt; — Remove admin (owner only)\n`;
    }
    bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  });

  // ── All other text messages ──────────────────────────────────────────────
  bot.on("message", (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    const userId = msg.from!.id;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const db = loadDB();
    const admin = isAdmin(db, userId);
    const userState = getState(userId);

    // ── NOT logged in → only handle password input ──
    if (!isLoggedIn(userId)) {
      if (userState.state !== "waiting_for_password") {
        sendLoginPrompt(bot, chatId);
        return;
      }
      // Check password
      if (text === db.loginPassword) {
        login(userId);
        clearState(userId);
        // Save user info
        const u = getUser(db, userId);
        if (!u.firstName && msg.from?.first_name) {
          u.firstName = msg.from.first_name;
          u.username = msg.from.username;
          db.users[String(userId)] = u;
          saveDB(db);
        }
        bot.sendMessage(chatId, `✅ <b>Login successful!</b>\n\n👋 Hello, welcome to panel!`, {
          parse_mode: "HTML",
          reply_markup: mainMenuKeyboard(admin),
        });
      } else {
        bot.sendMessage(
          chatId,
          `❌ <b>Wrong password!</b>\n\nTry again:`,
          { parse_mode: "HTML" }
        );
      }
      return;
    }

    // ── Logged in ──────────────────────────────────────────────────────────

    // Cancel
    if (text === "❌ Cancel") {
      clearState(userId);
      bot.sendMessage(chatId, "❌ Action cancelled.", {
        reply_markup: mainMenuKeyboard(admin),
      });
      return;
    }

    // Main menu buttons (only when idle)
    if (userState.state === "idle") {
      if (text === "🛍 Buy keys") {
        handleBuyKeys(bot, chatId, userId);
        return;
      }
      if (text === "🏦 Account") {
        handleAccount(bot, chatId, userId);
        return;
      }
      if (text === "🚀 Log out") {
        handleLogout(bot, chatId, userId);
        return;
      }
      if (text === "🔧 Manage" && admin) {
        handleManage(bot, chatId, userId);
        return;
      }
      if (text === "📦 Stock" && admin) {
        handleStock(bot, chatId, userId);
        return;
      }
      if (text === "📊 Statistics" && admin) {
        handleStatistics(bot, chatId, userId);
        return;
      }
      return;
    }

    // State-based input
    handleStateInput(bot, chatId, userId, text, admin);
  });

  // ── Callback queries ─────────────────────────────────────────────────────
  bot.on("callback_query", (query) => {
    const userId = query.from.id;
    const chatId = query.message!.chat.id;
    const msgId = query.message!.message_id;
    const data = query.data || "";
    const db = loadDB();
    const admin = isAdmin(db, userId);

    bot.answerCallbackQuery(query.id);

    // Block non-logged-in users from callbacks
    if (!isLoggedIn(userId)) {
      bot.sendMessage(chatId, "🔐 Please log in first. Send /start");
      return;
    }

    if (data.startsWith("cat:")) {
      const categoryId = data.split(":")[1]!;
      showProducts(bot, chatId, msgId, userId, categoryId);
      return;
    }

    if (data === "buy_back") {
      bot.editMessageText("🛍 Choose a category:", {
        chat_id: chatId,
        message_id: msgId,
        reply_markup: categoryInlineKeyboard(db.categories, "cat"),
      });
      return;
    }

    if (data.startsWith("buy:")) {
      const [, categoryId, productId] = data.split(":");
      const cat = db.categories.find((c) => c.id === categoryId);
      const prod = cat?.products.find((p) => p.id === productId);
      if (!cat || !prod) return;
      const user = getUser(db, userId);
      const stockCount = getStockCount(db, categoryId!, productId!);

      if (stockCount === 0) {
        bot.editMessageText(`❌ Sorry, <b>${prod.name}</b> is out of stock!`, {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬅️ Back", callback_data: `cat:${categoryId}` }],
            ],
          },
        });
        return;
      }

      bot.editMessageText(
        `🛍 <b>${prod.name}</b>\n💰 Price: <b>$${prod.price}</b>\n📦 In stock: <b>${stockCount}</b>\n💳 Your balance: <b>$${user.balance}</b>\n\nConfirm purchase?`,
        {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "HTML",
          reply_markup: confirmBuyKeyboard(categoryId!, productId!),
        }
      );
      return;
    }

    if (data.startsWith("confirm_buy:")) {
      const [, categoryId, productId] = data.split(":");
      handleConfirmBuy(bot, chatId, msgId, userId, categoryId!, productId!);
      return;
    }

    if (data.startsWith("manage:") && admin) {
      const action = data.split(":")[1]!;
      handleManageAction(bot, chatId, msgId, userId, action);
      return;
    }

    if (data.startsWith("adm_cat:") && admin) {
      const categoryId = data.split(":")[1]!;
      if (categoryId === "cancel") {
        clearState(userId);
        bot.editMessageText("❌ Cancelled.", { chat_id: chatId, message_id: msgId });
        return;
      }
      const state = getState(userId);
      if (state.state === "admin_add_stock_select_category") {
        setState(userId, "admin_add_stock_select_product", { categoryId });
        const cat = db.categories.find((c) => c.id === categoryId);
        if (!cat) return;
        bot.editMessageText("📦 Select product to add stock:", {
          chat_id: chatId,
          message_id: msgId,
          reply_markup: adminProductKeyboard(cat.products, categoryId, "adm_prod"),
        });
      } else if (state.state === "admin_delete_category") {
        const idx = db.categories.findIndex((c) => c.id === categoryId);
        if (idx !== -1) {
          const name = db.categories[idx]!.name;
          db.categories.splice(idx, 1);
          saveDB(db);
          clearState(userId);
          bot.editMessageText(`✅ Category <b>${name}</b> deleted.`, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: "HTML",
          });
        }
      } else if (state.state === "admin_add_product_name") {
        setState(userId, "admin_add_product_name", { categoryId });
        bot.editMessageText("📝 Enter the product name:", {
          chat_id: chatId,
          message_id: msgId,
        });
        bot.sendMessage(chatId, "Type the product name:", { reply_markup: cancelKeyboard() });
      } else if (state.state === "admin_delete_product") {
        setState(userId, "admin_delete_product", { categoryId });
        const cat = db.categories.find((c) => c.id === categoryId);
        if (!cat) return;
        bot.editMessageText("🗑 Select product to delete:", {
          chat_id: chatId,
          message_id: msgId,
          reply_markup: adminProductKeyboard(cat.products, categoryId, "adm_del_prod"),
        });
      }
      return;
    }

    if (data.startsWith("adm_prod:") && admin) {
      const parts = data.split(":");
      const categoryId = parts[1]!;
      const productId = parts[2]!;
      if (productId === "cancel") {
        clearState(userId);
        bot.editMessageText("❌ Cancelled.", { chat_id: chatId, message_id: msgId });
        return;
      }
      setState(userId, "admin_add_stock_keys", { categoryId, productId });
      bot.editMessageText("🔑 Send keys one per line:", {
        chat_id: chatId,
        message_id: msgId,
      });
      bot.sendMessage(chatId, "Paste your keys (one per line):", {
        reply_markup: cancelKeyboard(),
      });
      return;
    }

    if (data.startsWith("adm_del_prod:") && admin) {
      const parts = data.split(":");
      const categoryId = parts[1]!;
      const productId = parts[2]!;
      if (productId === "cancel") {
        clearState(userId);
        bot.editMessageText("❌ Cancelled.", { chat_id: chatId, message_id: msgId });
        return;
      }
      const cat = db.categories.find((c) => c.id === categoryId);
      if (!cat) return;
      const pIdx = cat.products.findIndex((p) => p.id === productId);
      if (pIdx !== -1) {
        const name = cat.products[pIdx]!.name;
        cat.products.splice(pIdx, 1);
        saveDB(db);
        clearState(userId);
        bot.editMessageText(`✅ Product <b>${name}</b> deleted.`, {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "HTML",
        });
      }
      return;
    }
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function handleBuyKeys(bot: TelegramBot, chatId: number, userId: number) {
  const db = loadDB();
  if (db.categories.length === 0) {
    bot.sendMessage(chatId, "❌ No categories available yet.");
    return;
  }
  bot.sendMessage(chatId, "🛍 Choose a category:", {
    reply_markup: categoryInlineKeyboard(db.categories, "cat"),
  });
}

function showProducts(
  bot: TelegramBot,
  chatId: number,
  msgId: number,
  userId: number,
  categoryId: string
) {
  const db = loadDB();
  const cat = db.categories.find((c) => c.id === categoryId);
  if (!cat) return;
  const stockCounts: Record<string, number> = {};
  for (const p of cat.products) {
    stockCounts[p.id] = getStockCount(db, categoryId, p.id);
  }
  bot.editMessageText(`📂 <b>${cat.name}</b>\nChoose a product:`, {
    chat_id: chatId,
    message_id: msgId,
    parse_mode: "HTML",
    reply_markup: productInlineKeyboard(cat.products, categoryId, stockCounts),
  });
}

function handleAccount(bot: TelegramBot, chatId: number, userId: number) {
  const db = loadDB();
  const user = getUser(db, userId);
  bot.sendMessage(
    chatId,
    `🏦 <b>Your Account</b>\n\n👤 ID: <code>${userId}</code>\n💳 Balance: <b>$${user.balance}</b>\n🛒 Total Purchases: <b>${user.purchases.length}</b>\n📅 Member since: <b>${new Date(user.createdAt).toLocaleDateString()}</b>`,
    { parse_mode: "HTML" }
  );
}

function handleLogout(bot: TelegramBot, chatId: number, userId: number) {
  logout(userId);
  bot.sendMessage(
    chatId,
    `🚀 <b>You have been logged out.</b>\n\nSend /start to log in again.`,
    {
      parse_mode: "HTML",
      reply_markup: { remove_keyboard: true },
    }
  );
}

function handleManage(bot: TelegramBot, chatId: number, userId: number) {
  bot.sendMessage(chatId, "🔧 <b>Manage Panel</b>\nChoose an action:", {
    parse_mode: "HTML",
    reply_markup: manageInlineKeyboard(),
  });
}

function handleStock(bot: TelegramBot, chatId: number, userId: number) {
  const db = loadDB();
  if (db.categories.length === 0) {
    bot.sendMessage(chatId, "📦 No categories yet.");
    return;
  }
  let text = "📦 <b>Current Stock</b>\n\n";
  for (const cat of db.categories) {
    text += `📂 <b>${cat.name}</b>\n`;
    for (const prod of cat.products) {
      const count = getStockCount(db, cat.id, prod.id);
      text += `  • ${prod.name} ($${prod.price}): <b>${count} keys</b>\n`;
    }
    text += "\n";
  }
  text += `📊 Total available: <b>${getTotalStockCount(db)}</b> keys`;
  bot.sendMessage(chatId, text, { parse_mode: "HTML" });
}

function handleStatistics(bot: TelegramBot, chatId: number, userId: number) {
  const db = loadDB();
  const totalUsers = Object.keys(db.users).length;
  const totalSold = getTotalSold(db);
  const totalStock = getTotalStockCount(db);
  bot.sendMessage(
    chatId,
    `📊 <b>Statistics</b>\n\n👥 Total Users: <b>${totalUsers}</b>\n🔑 Keys Sold: <b>${totalSold}</b>\n📦 Keys in Stock: <b>${totalStock}</b>\n💰 Total Revenue: <b>$${db.totalRevenue.toFixed(2)}</b>`,
    { parse_mode: "HTML" }
  );
}

function handleManageAction(
  bot: TelegramBot,
  chatId: number,
  msgId: number,
  userId: number,
  action: string
) {
  const db = loadDB();
  if (action === "add_category") {
    setState(userId, "admin_add_category");
    bot.editMessageText("📝 Enter the name for the new category:", {
      chat_id: chatId,
      message_id: msgId,
    });
    bot.sendMessage(chatId, "Type the category name:", { reply_markup: cancelKeyboard() });
  } else if (action === "add_product") {
    setState(userId, "admin_add_product_name");
    bot.editMessageText("📂 Select a category for the new product:", {
      chat_id: chatId,
      message_id: msgId,
      reply_markup: adminCategoryKeyboard(db.categories, "adm_cat"),
    });
  } else if (action === "del_category") {
    setState(userId, "admin_delete_category");
    bot.editMessageText("🗑 Select a category to delete:", {
      chat_id: chatId,
      message_id: msgId,
      reply_markup: adminCategoryKeyboard(db.categories, "adm_cat"),
    });
  } else if (action === "del_product") {
    setState(userId, "admin_delete_product");
    bot.editMessageText("📂 Select a category:", {
      chat_id: chatId,
      message_id: msgId,
      reply_markup: adminCategoryKeyboard(db.categories, "adm_cat"),
    });
  } else if (action === "add_stock") {
    setState(userId, "admin_add_stock_select_category");
    bot.editMessageText("📂 Select a category:", {
      chat_id: chatId,
      message_id: msgId,
      reply_markup: adminCategoryKeyboard(db.categories, "adm_cat"),
    });
  }
}

function handleConfirmBuy(
  bot: TelegramBot,
  chatId: number,
  msgId: number,
  userId: number,
  categoryId: string,
  productId: string
) {
  const db = loadDB();
  const cat = db.categories.find((c) => c.id === categoryId);
  const prod = cat?.products.find((p) => p.id === productId);
  if (!cat || !prod) return;

  const user = getUser(db, userId);
  const stockItem = db.stock.find(
    (s) => s.categoryId === categoryId && s.productId === productId && !s.sold
  );

  if (!stockItem) {
    bot.editMessageText("❌ Sorry, this product is now out of stock!", {
      chat_id: chatId,
      message_id: msgId,
    });
    return;
  }

  if (user.balance < prod.price) {
    bot.editMessageText(
      `❌ <b>Insufficient balance!</b>\n\n💳 Your balance: <b>$${user.balance}</b>\n💰 Required: <b>$${prod.price}</b>\n\nPlease contact admin to add funds.`,
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML" }
    );
    return;
  }

  // Process purchase
  stockItem.sold = true;
  stockItem.soldTo = userId;
  stockItem.soldAt = new Date().toISOString();
  user.balance -= prod.price;
  user.purchases.push(stockItem.id);
  db.totalRevenue += prod.price;
  db.users[String(userId)] = user;
  saveDB(db);

  bot.editMessageText(
    `✅ <b>Purchase Successful!</b>\n\n🔑 Your key:\n<code>${stockItem.key}</code>\n\n📦 Product: <b>${prod.name}</b>\n💳 Remaining balance: <b>$${user.balance}</b>`,
    { chat_id: chatId, message_id: msgId, parse_mode: "HTML" }
  );
}

function handleStateInput(
  bot: TelegramBot,
  chatId: number,
  userId: number,
  text: string,
  admin: boolean
) {
  const db = loadDB();
  const state = getState(userId);

  if (state.state === "admin_set_password" && admin) {
    const newPass = text.trim();
    if (!newPass || newPass.length < 3) {
      bot.sendMessage(chatId, "❌ Password too short (min 3 chars). Try again:");
      return;
    }
    db.loginPassword = newPass;
    saveDB(db);
    clearState(userId);
    bot.sendMessage(chatId, `✅ Login password updated to: <code>${newPass}</code>`, {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(admin),
    });
    return;
  }

  if (state.state === "admin_add_category" && admin) {
    const name = text.trim();
    if (!name) {
      bot.sendMessage(chatId, "❌ Invalid name. Try again:");
      return;
    }
    const newCat: Category = { id: slugify(name), name, products: [] };
    db.categories.push(newCat);
    saveDB(db);
    clearState(userId);
    bot.sendMessage(chatId, `✅ Category <b>${name}</b> added!`, {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(admin),
    });
    return;
  }

  if (state.state === "admin_add_product_name" && admin) {
    setState(userId, "admin_add_product_price", {
      ...state.data,
      productName: text.trim(),
    });
    bot.sendMessage(chatId, "💰 Enter the price in $ (e.g. 5):", {
      reply_markup: cancelKeyboard(),
    });
    return;
  }

  if (state.state === "admin_add_product_price" && admin) {
    const price = parseFloat(text.trim());
    if (isNaN(price) || price <= 0) {
      bot.sendMessage(chatId, "❌ Invalid price. Enter a number (e.g. 5):");
      return;
    }
    setState(userId, "admin_add_product_period", {
      ...state.data,
      productPrice: String(price),
    });
    bot.sendMessage(chatId, "📅 Enter the period (e.g. Day, Week, Month):", {
      reply_markup: cancelKeyboard(),
    });
    return;
  }

  if (state.state === "admin_add_product_period" && admin) {
    const period = text.trim();
    const { categoryId, productName, productPrice } = state.data;
    const cat = db.categories.find((c) => c.id === categoryId);
    if (!cat) {
      clearState(userId);
      bot.sendMessage(chatId, "❌ Category not found.", {
        reply_markup: mainMenuKeyboard(admin),
      });
      return;
    }
    const newProd: Product = {
      id: slugify(productName!),
      name: productName!,
      price: parseFloat(productPrice!),
      period,
    };
    cat.products.push(newProd);
    saveDB(db);
    clearState(userId);
    bot.sendMessage(
      chatId,
      `✅ Product <b>${productName}</b> ($${productPrice}) added to <b>${cat.name}</b>!`,
      { parse_mode: "HTML", reply_markup: mainMenuKeyboard(admin) }
    );
    return;
  }

  if (state.state === "admin_add_stock_keys" && admin) {
    const { categoryId, productId } = state.data;
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      bot.sendMessage(chatId, "❌ No valid keys found. Send keys one per line:");
      return;
    }
    for (const key of lines) {
      db.stock.push({
        id: uuidv4(),
        categoryId: categoryId!,
        productId: productId!,
        key,
        sold: false,
      });
    }
    saveDB(db);
    clearState(userId);
    bot.sendMessage(chatId, `✅ Added <b>${lines.length}</b> keys to stock!`, {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(admin),
    });
    return;
  }
}
