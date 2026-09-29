import { Router, type IRouter } from "express";
const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    neo4j: "checking",
    message: null,
  });
});

export default router;
