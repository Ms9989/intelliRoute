import { Router, type IRouter } from "express";
import intellirouteRouter from "./intelliroute";

const router: IRouter = Router();

router.use(intellirouteRouter);

export default router;
