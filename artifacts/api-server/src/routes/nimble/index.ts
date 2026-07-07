import { Router, type IRouter } from "express";
import dashboardRouter from "./dashboard.js";
import alertsRouter from "./alerts.js";
import conversationsRouter from "./conversations.js";

const router: IRouter = Router();

router.use(dashboardRouter);
router.use(alertsRouter);
router.use(conversationsRouter);

export default router;
