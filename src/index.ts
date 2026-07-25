import "dotenv/config";
import express from "express";
import cors from "cors";
import bannersRouter from "./routes/banners";
import ordersRouter from "./routes/orders";

const app = express();

app.use(
    cors({
        origin: process.env.FRONTEND_ORIGIN?.split(",") ?? "*",
    }),
);
app.use(express.json());

app.get("/", (_req, res) => {
    res.json({ message: "fastcart-server работает" });
});

app.use("/api/banners", bannersRouter);
app.use("/api/orders", ordersRouter);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
    console.log(`fastcart-server слушает порт ${port}`);
});
