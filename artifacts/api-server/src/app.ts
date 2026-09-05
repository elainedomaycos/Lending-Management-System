import { createRequire } from "node:module";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { HttpLogger, Options } from "pino-http";
import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";
import { logger } from "./lib/logger";

// pino-http is a CommonJS module (module.exports = callable) but ships
// ESM-style typings (export default). Loading it at runtime avoids the
// "has no call signatures" type error under stricter module resolution.
const require = createRequire(import.meta.url);
const pinoHttp = require("pino-http") as (
  options: Options<IncomingMessage, ServerResponse>,
) => HttpLogger<IncomingMessage, ServerResponse>;

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
