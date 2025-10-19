import cors from "cors";
import express, { type Request, type Response, type NextFunction } from "express";
import devRouter from "./routes/dev";

export const createServer = () => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).send("OK");
  });

  app.use("/api/dev", devRouter);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong"
      }
    });
  });

  return app;
};
