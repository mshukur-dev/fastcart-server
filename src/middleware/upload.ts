import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";

// Файлы лежат в <корень проекта>/uploads, а не рядом с dist/src — так путь
// не меняется между `npm run dev` (tsx) и `npm run build && npm start`
// (node dist/index.js). ВАЖНО: на бесплатном Render диск эфемерный —
// эта папка (и всё, что в неё загружено) пропадает при каждом новом
// деплое или когда инстанс "усыпает" и просыпается заново. Для учебного
// проекта это осознанный компромисс (см. CLAUDE.md), для настоящего
// прода сюда нужно внешнее хранилище (S3, Cloudinary и т.п.).
export const UPLOADS_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    },
});

export const uploadImage = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            cb(new Error("Файл должен быть изображением"));
            return;
        }
        cb(null, true);
    },
});
