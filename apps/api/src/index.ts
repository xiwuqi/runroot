import { buildServer } from "./server";

const host = process.env.RUNROOT_API_HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.RUNROOT_API_PORT ?? "3001", 10);

const app = buildServer();

app
  .listen({
    host,
    port,
  })
  .catch(async (error) => {
    app.log.error(error);
    await app.close();
    process.exitCode = 1;
  });
