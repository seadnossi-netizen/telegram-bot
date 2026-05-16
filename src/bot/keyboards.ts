import TelegramBot from "node-telegram-bot-api";

export function mainMenuKeyboard(isAdmin: boolean): TelegramBot.ReplyKeyboardMarkup {
  const keyboard: TelegramBot.KeyboardButton[][] = [
    [{ text: "🛍 Buy keys" }],
    [{ text: "🏦 Account" }, { text: "🚀 Log out" }],
  ];
  if (isAdmin) {
    keyboard.push([{ text: "🔧 Manage" }, { text: "📦 Stock" }]);
    keyboard.push([{ text: "📊 Statistics" }]);
  }
  return {
    keyboard,
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

export function cancelKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: [[{ text: "❌ Cancel" }]],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

export function removeKeyboard(): TelegramBot.ReplyKeyboardRemove {
  return { remove_keyboard: true };
}

export function categoryInlineKeyboard(
  categories: { id: string; name: string }[],
  prefix: string = "cat"
): TelegramBot.InlineKeyboardMarkup {
  const buttons = categories.map((c) => [
    { text: c.name, callback_data: `${prefix}:${c.id}` },
  ]);
  return { inline_keyboard: buttons };
}

export function productInlineKeyboard(
  products: { id: string; name: string; price: number; period: string }[],
  categoryId: string,
  stockCounts: Record<string, number>
): TelegramBot.InlineKeyboardMarkup {
  const buttons = products.map((p) => {
    const count = stockCounts[p.id] ?? 0;
    return [
      {
        text: `${p.name} — $${p.price} (${count} in stock)`,
        callback_data: `buy:${categoryId}:${p.id}`,
      },
    ];
  });
  buttons.push([{ text: "⬅️ Back", callback_data: "buy_back" }]);
  return { inline_keyboard: buttons };
}

export function manageInlineKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "➕ Add Category", callback_data: "manage:add_category" }],
      [{ text: "➕ Add Product", callback_data: "manage:add_product" }],
      [{ text: "🗑 Delete Category", callback_data: "manage:del_category" }],
      [{ text: "🗑 Delete Product", callback_data: "manage:del_product" }],
    ],
  };
}

export function adminCategoryKeyboard(
  categories: { id: string; name: string }[],
  prefix: string
): TelegramBot.InlineKeyboardMarkup {
  const buttons = categories.map((c) => [
    { text: c.name, callback_data: `${prefix}:${c.id}` },
  ]);
  buttons.push([{ text: "❌ Cancel", callback_data: `${prefix}:cancel` }]);
  return { inline_keyboard: buttons };
}

export function adminProductKeyboard(
  products: { id: string; name: string }[],
  categoryId: string,
  prefix: string
): TelegramBot.InlineKeyboardMarkup {
  const buttons = products.map((p) => [
    { text: p.name, callback_data: `${prefix}:${categoryId}:${p.id}` },
  ]);
  buttons.push([{ text: "❌ Cancel", callback_data: `${prefix}:cancel` }]);
  return { inline_keyboard: buttons };
}

export function confirmBuyKeyboard(
  categoryId: string,
  productId: string
): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "✅ Confirm Purchase", callback_data: `confirm_buy:${categoryId}:${productId}` },
        { text: "❌ Cancel", callback_data: "buy_back" },
      ],
    ],
  };
}
