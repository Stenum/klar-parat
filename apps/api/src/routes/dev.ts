import { Router, type Request, type Response } from "express";
import { featureFlags } from "../config/featureFlags";
import { getFakeTtsBuffer } from "../services/fakeTts";

const router = Router();

router.post("/fake-llm", (_req: Request, res: Response) => {
  if (!featureFlags.useFakeLLM) {
    return res.status(503).json({
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Fake LLM disabled"
      }
    });
  }

  return res.json({
    content: "Way to go! Let's tackle the next step together."
  });
});

router.get("/fake-tts", async (_req: Request, res: Response) => {
  if (!featureFlags.useFakeTTS) {
    return res.status(503).json({
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Fake TTS disabled"
      }
    });
  }

  const buffer = await getFakeTtsBuffer();
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  return res.send(buffer);
});

export default router;
