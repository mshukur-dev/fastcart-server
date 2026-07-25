import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { orderItems, orders } from "../db/schema";
import { requireAuth, requireRole } from "../middleware/auth";

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

/**
 * @openapi
 * components:
 *   schemas:
 *     OrderItemInput:
 *       type: object
 *       required: [productId, productName, price, quantity]
 *       properties:
 *         productId: { type: integer }
 *         productName: { type: string }
 *         price: { type: number }
 *         quantity: { type: integer }
 *     OrderInput:
 *       type: object
 *       required: [firstName, lastName, streetAddress, townCity, phoneNumber, email, paymentMethod, items]
 *       properties:
 *         firstName: { type: string }
 *         lastName: { type: string }
 *         streetAddress: { type: string }
 *         apartment: { type: string }
 *         townCity: { type: string }
 *         phoneNumber: { type: string }
 *         email: { type: string }
 *         paymentMethod: { type: string, enum: [bank, cod] }
 *         items:
 *           type: array
 *           items: { $ref: '#/components/schemas/OrderItemInput' }
 *     Order:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         userId: { type: integer }
 *         firstName: { type: string }
 *         lastName: { type: string }
 *         streetAddress: { type: string }
 *         apartment: { type: string, nullable: true }
 *         townCity: { type: string }
 *         phoneNumber: { type: string }
 *         email: { type: string }
 *         paymentMethod: { type: string }
 *         subtotal: { type: number }
 *         status: { type: string }
 *         createdAt: { type: string, format: date-time }
 *         items:
 *           type: array
 *           items: { $ref: '#/components/schemas/OrderItemInput' }
 */

/**
 * @openapi
 * /api/orders:
 *   post:
 *     summary: Создать заказ (авторизованный пользователь)
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/OrderInput' }
 *     responses:
 *       201:
 *         description: Созданный заказ с позициями
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Order' }
 *       400:
 *         description: Не хватает обязательных полей
 *       401:
 *         description: Нет/невалидный токен
 */
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

/**
 * @openapi
 * /api/orders:
 *   get:
 *     summary: Список заказов текущего пользователя (с позициями)
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Заказы текущего пользователя вместе с позициями, новые сверху
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Order' }
 */
// Список заказов текущего пользователя (только свои — не все заказы всех).
router.get("/", async (req, res) => {
    const userOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.userId, req.user!.id))
        .orderBy(desc(orders.createdAt));

    if (userOrders.length === 0) {
        return res.json({ data: [] });
    }

    const items = await db
        .select()
        .from(orderItems)
        .where(
            inArray(
                orderItems.orderId,
                userOrders.map((order) => order.id),
            ),
        );

    const data = userOrders.map((order) => ({
        ...order,
        items: items.filter((item) => item.orderId === order.id),
    }));

    res.json({ data });
});

/**
 * @openapi
 * /api/orders/all:
 *   get:
 *     summary: Все заказы всех пользователей, с позициями (Admin/SuperAdmin)
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Все заказы, новые сверху
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Order' }
 *       403:
 *         description: Недостаточно прав
 */
// Для дашборда админки — заказы ВСЕХ пользователей, а не только текущего.
// Отдельный роут (а не параметр у GET /), чтобы не усложнять права доступа
// на самом частом эндпоинте "мои заказы".
router.get(
    "/all",
    requireRole("Admin", "SuperAdmin"),
    async (_req, res) => {
        const allOrders = await db
            .select()
            .from(orders)
            .orderBy(desc(orders.createdAt));

        if (allOrders.length === 0) {
            return res.json({ data: [] });
        }

        const items = await db
            .select()
            .from(orderItems)
            .where(
                inArray(
                    orderItems.orderId,
                    allOrders.map((order) => order.id),
                ),
            );

        const data = allOrders.map((order) => ({
            ...order,
            items: items.filter((item) => item.orderId === order.id),
        }));

        res.json({ data });
    },
);

const ORDER_STATUSES = [
    "pending",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
];

/**
 * @openapi
 * /api/orders/{id}/status:
 *   patch:
 *     summary: Изменить статус заказа (Admin/SuperAdmin)
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, processing, shipped, delivered, cancelled]
 *     responses:
 *       200:
 *         description: Обновлённый заказ
 *       400:
 *         description: Некорректный статус
 *       403:
 *         description: Недостаточно прав
 *       404:
 *         description: Заказ не найден
 */
router.patch(
    "/:id/status",
    requireRole("Admin", "SuperAdmin"),
    async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ message: "Некорректный id" });
        }

        const { status } = req.body as { status?: string };
        if (!status || !ORDER_STATUSES.includes(status)) {
            return res.status(400).json({
                message: `status должен быть одним из: ${ORDER_STATUSES.join(", ")}`,
            });
        }

        const [updated] = await db
            .update(orders)
            .set({ status, updatedAt: new Date() })
            .where(eq(orders.id, id))
            .returning();

        if (!updated) {
            return res.status(404).json({ message: "Заказ не найден" });
        }

        res.json({ data: updated });
    },
);

/**
 * @openapi
 * /api/orders/{id}:
 *   delete:
 *     summary: Удалить заказ (Admin/SuperAdmin)
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Удалён
 *       403:
 *         description: Недостаточно прав
 *       404:
 *         description: Заказ не найден
 */
// orderItems удаляются автоматически (onDelete: "cascade" в схеме).
router.delete(
    "/:id",
    requireRole("Admin", "SuperAdmin"),
    async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ message: "Некорректный id" });
        }

        const [deleted] = await db
            .delete(orders)
            .where(eq(orders.id, id))
            .returning();

        if (!deleted) {
            return res.status(404).json({ message: "Заказ не найден" });
        }

        res.status(204).send();
    },
);

/**
 * @openapi
 * /api/orders/{id}:
 *   get:
 *     summary: Один заказ с позициями (только если принадлежит текущему пользователю)
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Заказ с позициями
 *       404:
 *         description: Заказ не найден или принадлежит другому пользователю
 */
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
