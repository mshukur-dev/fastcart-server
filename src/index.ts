import "dotenv/config";
import express, {
    type ErrorRequestHandler,
} from "express";
import cors from "cors";
import multer from "multer";
import swaggerUi from "swagger-ui-express";
import bannersRouter from "./routes/banners";
import ordersRouter from "./routes/orders";
import { swaggerSpec } from "./swagger";
import { UPLOADS_DIR } from "./middleware/upload";

const app = express();

app.use(
    cors({
        origin: process.env.FRONTEND_ORIGIN?.split(",") ?? "*",
    }),
);
app.use(express.json());

// Раздача загруженных картинок (см. src/middleware/upload.ts — эфемерно
// на бесплатном Render, но живёт, пока инстанс не перезапустится).
app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/", (_req, res) => {
    res.json({ message: "fastcart-server работает" });
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/banners", bannersRouter);
app.use("/api/orders", ordersRouter);

// Ловит ошибки multer (например, превышение лимита размера файла) и
// возвращает JSON вместо дефолтной HTML-страницы Express.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: err.message });
    }
    if (err instanceof Error) {
        return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Внутренняя ошибка сервера" });
};
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
    console.log(`fastcart-server слушает порт ${port}`);
});
