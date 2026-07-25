import {
    pgTable,
    serial,
    integer,
    text,
    boolean,
    doublePrecision,
    timestamp,
} from "drizzle-orm/pg-core";

// Слайд hero-баннера на главной странице фронта.
export const banners = pgTable("banners", {
    id: serial("id").primaryKey(),
    eyebrow: text("eyebrow").notNull(), // маленькая надпись сверху, например "iPhone 14 Series"
    title: text("title").notNull(), // крупный заголовок, например "Up to 10% off Voucher"
    imageUrl: text("image_url").notNull(), // ссылка на картинку (внешний URL, без своего файлового хранилища)
    imageAlt: text("image_alt").notNull(),
    linkUrl: text("link_url").notNull().default("#"), // куда ведёт "Shop Now"
    sortOrder: integer("sort_order").notNull().default(0), // порядок показа слайдов
    isActive: boolean("is_active").notNull().default(true), // выключить слайд, не удаляя
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Заказ. userId берётся из JWT основного бэкенда (fastcard-1-o23z) — это
// не внешний ключ на таблицу пользователей, потому что пользователи живут
// в другой базе данных, к которой у этого сервиса нет доступа.
export const orders = pgTable("orders", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    streetAddress: text("street_address").notNull(),
    apartment: text("apartment"),
    townCity: text("town_city").notNull(),
    phoneNumber: text("phone_number").notNull(),
    email: text("email").notNull(),
    paymentMethod: text("payment_method").notNull(), // "bank" | "cod"
    subtotal: doublePrecision("subtotal").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Товары внутри заказа хранятся "снимком" на момент покупки (id, название,
// цена) — а не ссылкой на живой каталог, потому что каталог товаров тоже
// живёт на другом бэкенде и может измениться или удалиться позже.
export const orderItems = pgTable("order_items", {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
        .notNull()
        .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull(),
    productName: text("product_name").notNull(),
    price: doublePrecision("price").notNull(),
    quantity: integer("quantity").notNull(),
});
