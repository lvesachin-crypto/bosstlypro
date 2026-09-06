import { Router, type IRouter } from "express";
import healthRouter from "./health";
import legacyAuthRouter from "./legacyAuth";
import boostlyRouter from "./boostly";
import legacyDataRouter from "./legacyData";

const router: IRouter = Router();

router.use(healthRouter);
router.use(legacyAuthRouter);
router.use(boostlyRouter);
router.use(legacyDataRouter);

export default router;
