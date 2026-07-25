import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
    id: number;
    roles: string[];
}

// express.d.ts (в этой же папке) добавляет req.user в типы Request.

interface MainBackendJwtPayload {
    id: number;
    role: string | string[];
    exp: number;
}

// ВАЖНО: мы не проверяем подпись токена (jwt.verify), а просто декодируем
// его (jwt.decode) — потому что этот токен выпускает ДРУГОЙ бэкенд
// (fastcard-1-o23z), и у нас нет секретного ключа, которым он подписан.
// Это значит, что теоретически можно подделать токен с любым userId/ролью.
// Для учебного проекта это осознанный компромисс (см. обсуждение в чате),
// но для настоящего продакшена сюда нужен либо общий секрет с основным
// бэкендом, либо собственная система авторизации.
function decodeUser(authHeader: string | undefined): AuthUser | null {
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice("Bearer ".length);

    const payload = jwt.decode(token) as MainBackendJwtPayload | null;
    if (!payload) return null;
    if (payload.exp * 1000 < Date.now()) return null;

    return {
        id: payload.id,
        roles: Array.isArray(payload.role) ? payload.role : [payload.role],
    };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const user = decodeUser(req.headers.authorization);
    if (!user) {
        return res.status(401).json({ message: "Требуется авторизация" });
    }
    req.user = user;
    next();
}

export function requireRole(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = decodeUser(req.headers.authorization);
        if (!user) {
            return res.status(401).json({ message: "Требуется авторизация" });
        }
        if (!roles.some((role) => user.roles.includes(role))) {
            return res.status(403).json({ message: "Недостаточно прав" });
        }
        req.user = user;
        next();
    };
}
