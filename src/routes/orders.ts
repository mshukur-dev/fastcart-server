import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { orderItems, orders } from "../db/schema";
import { requireAuth } from "../middleware/auth";

const router = Router();

// Все роуты заказов требуют авторизации — заказ всегда привязан
// к конкретному пользователю (req.user.id из декодированного токена).
router.use(requireAuth);

interface OrderItemInput {
    productId: number;
    productName: string;
    price: number;
    quantity: number;
}

router.post("/", async (req, res) => {
    const {
        firstName,
        lastName,
        streetAddress,
        apartment,
        townCity,
        phoneNumber,
        email,
        paymentMethod,
        items,
    }: {
        firstName?: string;
        lastName?: string;
        streetAddress?: string;
        apartment?: string;
        townCity?: string;
        phoneNumber?: string;
        email?: string;
        paymentMethod?: string;
        items?: OrderItemInput[];
    } = req.body;

    if (
        !firstName ||
        !lastName ||
        !streetAddress ||
        !townCity ||
        !phoneNumber ||
        !email ||
        !paymentMethod ||
        !items?.length
    ) {
        return res.status(400).json({
            message:
                "firstName, lastName, streetAddress, townCity, phoneNumber, email, paymentMethod, items обязательны",
        });
    }

    const subtotal = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
    );

    // Заказ и его позиции создаются одной транзакцией — если сохранение
    // позиций упадёт, сам заказ тоже не должен остаться "пустым" в базе.
    const created = await db.transaction(async (tx) => {
        const [order] = await tx
            .insert(orders)
            .values({
                userId: req.user!.id,
                firstName,
                lastName,
                streetAddress,
                apartment,
                townCity,
                phoneNumber,
                email,
                paymentMethod,
                subtotal,
            })
            .returning();

        const insertedItems = await tx
            .insert(orderItems)
            .values(
                items.map((item) => ({
                    orderId: order.id,
                    productId: item.productId,
                    productName: item.productName,
                    price: item.price,
                    quantity: item.quantity,
                })),
            )
            .returning();

        return { ...order, items: insertedItems };
    });

    res.status(201).json({ data: created });
});

// Список заказов текущего пользователя (только свои — не все заказы всех).
router.get("/", async (req, res) => {
    const userOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.userId, req.user!.id))
        .orderBy(desc(orders.createdAt));

    res.json({ data: userOrders });
});

// Один заказ с позициями — тоже только если он принадлежит текущему юзеру.
router.get("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Некорректный id" });
    }

    const [order] = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, id), eq(orders.userId, req.user!.id)));

    if (!order) {
        return res.status(404).json({ message: "Заказ не найден" });
    }

    const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

    res.json({ data: { ...order, items } });
});

export default router;
