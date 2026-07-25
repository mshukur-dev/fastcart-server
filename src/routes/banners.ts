import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db } from "../db";
import { banners } from "../db/schema";
import { requireRole } from "../middleware/auth";

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     Banner:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         eyebrow: { type: string }
 *         title: { type: string }
 *         imageUrl: { type: string }
 *         imageAlt: { type: string }
 *         linkUrl: { type: string }
 *         sortOrder: { type: integer }
 *         isActive: { type: boolean }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     BannerInput:
 *       type: object
 *       required: [eyebrow, title, imageUrl, imageAlt]
 *       properties:
 *         eyebrow: { type: string }
 *         title: { type: string }
 *         imageUrl: { type: string }
 *         imageAlt: { type: string }
 *         linkUrl: { type: string }
 *         sortOrder: { type: integer }
 */

/**
 * @openapi
 * /api/banners:
 *   get:
 *     summary: Список активных баннеров (публичный)
 *     tags: [Banners]
 *     responses:
 *       200:
 *         description: Массив баннеров, отсортированных по sortOrder
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Banner' }
 */
// Публичный список — его вызывает главная страница фронта, логин не нужен.
// Показываем только активные баннеры, отсортированные по sortOrder.
router.get("/", async (_req, res) => {
    const data = await db
        .select()
        .from(banners)
        .where(eq(banners.isActive, true))
        .orderBy(asc(banners.sortOrder));
    res.json({ data });
});

/**
 * @openapi
 * /api/banners:
 *   post:
 *     summary: Создать баннер (Admin/SuperAdmin)
 *     tags: [Banners]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/BannerInput' }
 *     responses:
 *       201:
 *         description: Созданный баннер
 *       400:
 *         description: Не хватает обязательных полей
 *       401:
 *         description: Нет/невалидный токен
 *       403:
 *         description: Недостаточно прав
 */
// Дальше — управление баннерами, только для Admin/SuperAdmin.
router.post("/", requireRole("Admin", "SuperAdmin"), async (req, res) => {
    const { eyebrow, title, imageUrl, imageAlt, linkUrl, sortOrder } =
        req.body;

    if (!eyebrow || !title || !imageUrl || !imageAlt) {
        return res.status(400).json({
            message: "eyebrow, title, imageUrl, imageAlt обязательны",
        });
    }

    const [created] = await db
        .insert(banners)
        .values({ eyebrow, title, imageUrl, imageAlt, linkUrl, sortOrder })
        .returning();
    res.status(201).json({ data: created });
});

/**
 * @openapi
 * /api/banners/{id}:
 *   put:
 *     summary: Обновить баннер (Admin/SuperAdmin)
 *     tags: [Banners]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/BannerInput' }
 *     responses:
 *       200:
 *         description: Обновлённый баннер
 *       404:
 *         description: Баннер не найден
 */
router.put("/:id", requireRole("Admin", "SuperAdmin"), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Некорректный id" });
    }

    const { eyebrow, title, imageUrl, imageAlt, linkUrl, sortOrder, isActive } =
        req.body;

    const [updated] = await db
        .update(banners)
        .set({
            ...(eyebrow !== undefined && { eyebrow }),
            ...(title !== undefined && { title }),
            ...(imageUrl !== undefined && { imageUrl }),
            ...(imageAlt !== undefined && { imageAlt }),
            ...(linkUrl !== undefined && { linkUrl }),
            ...(sortOrder !== undefined && { sortOrder }),
            ...(isActive !== undefined && { isActive }),
            updatedAt: new Date(),
        })
        .where(eq(banners.id, id))
        .returning();

    if (!updated) {
        return res.status(404).json({ message: "Баннер не найден" });
    }
    res.json({ data: updated });
});

/**
 * @openapi
 * /api/banners/{id}:
 *   delete:
 *     summary: Удалить баннер (Admin/SuperAdmin)
 *     tags: [Banners]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Удалён
 *       404:
 *         description: Баннер не найден
 */
router.delete("/:id", requireRole("Admin", "SuperAdmin"), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Некорректный id" });
    }

    const [deleted] = await db
        .delete(banners)
        .where(eq(banners.id, id))
        .returning();

    if (!deleted) {
        return res.status(404).json({ message: "Баннер не найден" });
    }
    res.status(204).send();
});

export default router;
