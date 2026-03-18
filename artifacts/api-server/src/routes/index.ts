import { Router, type IRouter } from "express";
import healthRouter from "./health";
import castReceiverRouter from "./cast-receiver";
import usersRouter from "./users";
import childrenRouter from "./children";
import sessionsRouter from "./sessions";
import feedbackRouter from "./feedback";
import caregiversRouter from "./caregivers";

const router: IRouter = Router();

router.use(healthRouter);
router.use(castReceiverRouter);
router.use(usersRouter);
router.use(childrenRouter);
router.use(sessionsRouter);
router.use(feedbackRouter);
router.use(caregiversRouter);

export default router;
