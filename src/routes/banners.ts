import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db } from "../db";
import { banners } from "../db/schema";
import { requireRole } from "../middleware/auth";

const router = Router();

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
