import swaggerJsdoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: "3.0.0",
        info: {
            title: "fastcart-server API",
            version: "1.0.0",
            description:
                "Баннеры и заказы для fastcart. Авторизация — JWT, выданный основным бэкендом (fastcard-1-o23z); передавайте его как Bearer-токен.",
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
        },
    },
    apis: ["./src/routes/*.ts"],
});
