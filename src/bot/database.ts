import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../../data/db.json");

export interface Product {
  id: string;
  name: string;
  price: number;
  period: string;
}

export interface Category {
  id: string;
  name: string;
  products: Product[];
}

export interface StockItem {
  id: string;
  categoryId: string;
  productId: string;
  key: string;
  sold: boolean;
  soldTo?: number;
  soldAt?: string;
}

export interface User {
  userId: number;
  username?: string;
  firstName?: string;
  balance: number;
  purchases: string[];
  createdAt: string;
}

export interface DB {
  categories: Category[];
  stock: StockItem[];
  users: Record<string, User>;
  admins: number[];
  totalRevenue: number;
  loginPassword: string;
}

function ensureDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadDB(): DB {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) {
    const defaultDB: DB = {
      categories: [
        {
          id: "freefire",
          name: "Free Fire",
          products: [
            { id: "ff_day", name: "Free Fire - Day", price: 2, period: "Day" },
            { id: "ff_week", name: "Free Fire - Week", price: 8, period: "Week" },
            { id: "ff_month", name: "Free Fire - Month", price: 12, period: "Month" },
          ],
        },
      ],
      stock: [],
      users: {},
      admins: [7294172618],
      totalRevenue: 0,
      loginPassword: "1234",
    };
    saveDB(defaultDB);
    return defaultDB;
  }
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  const parsed = JSON.parse(raw) as DB;
  // migrate old DBs that don't have loginPassword
  if (!parsed.loginPassword) {
    parsed.loginPassword = "1234";
    saveDB(parsed);
  }
  return parsed;
}

export function saveDB(db: DB): void {
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

export function getUser(db: DB, userId: number): User {
  const key = String(userId);
  if (!db.users[key]) {
    db.users[key] = {
      userId,
      balance: 0,
      purchases: [],
      createdAt: new Date().toISOString(),
    };
    saveDB(db);
  }
  return db.users[key];
}

export function isAdmin(db: DB, userId: number): boolean {
  return db.admins.includes(userId);
}

export function getStockCount(db: DB, categoryId: string, productId: string): number {
  return db.stock.filter(
    (s) => s.categoryId === categoryId && s.productId === productId && !s.sold
  ).length;
}

export function getTotalStockCount(db: DB): number {
  return db.stock.filter((s) => !s.sold).length;
}

export function getTotalSold(db: DB): number {
  return db.stock.filter((s) => s.sold).length;
}
