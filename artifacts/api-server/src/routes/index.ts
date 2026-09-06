import { Router, type IRouter } from "express";
import healthRouter from "./health";
import legacyAuthRouter from "./legacyAuth";
import boostlyRouter from "./boostly";

const router: IRouter = Router();

router.use(healthRouter);
router.use(legacyAuthRouter);
router.use(boostlyRouter);

export default router;
