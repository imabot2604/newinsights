import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nimbleRouter from "./nimble/index.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nimbleRouter);

export default router;
