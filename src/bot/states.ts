export type BotState =
  | "idle"
  | "waiting_for_password"
  | "admin_add_category"
  | "admin_add_product_name"
  | "admin_add_product_price"
  | "admin_add_product_period"
  | "admin_add_stock_select_category"
  | "admin_add_stock_select_product"
  | "admin_add_stock_keys"
  | "admin_delete_category"
  | "admin_delete_product"
  | "admin_set_password"
  | "buying_select_category"
  | "buying_select_product";

export interface UserState {
  state: BotState;
  data: Record<string, string>;
}

const states = new Map<number, UserState>();

// Track which users are logged in (in memory — resets on restart, forcing re-login)
const loggedIn = new Set<number>();

export function getState(userId: number): UserState {
  if (!states.has(userId)) {
    states.set(userId, { state: "idle", data: {} });
  }
  return states.get(userId)!;
}

export function setState(userId: number, state: BotState, data: Record<string, string> = {}): void {
  states.set(userId, { state, data });
}

export function clearState(userId: number): void {
  states.set(userId, { state: "idle", data: {} });
}

export function isLoggedIn(userId: number): boolean {
  return loggedIn.has(userId);
}

export function login(userId: number): void {
  loggedIn.add(userId);
}

export function logout(userId: number): void {
  loggedIn.delete(userId);
  states.set(userId, { state: "idle", data: {} });
}
