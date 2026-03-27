import { copyFileSync, existsSync } from "node:fs";

const requiredNodeMajor = 20;
const currentNodeMajor = Number.parseInt(
  process.versions.node.split(".")[0] ?? "0",
  10,
);

if (currentNodeMajor < requiredNodeMajor) {
  throw new Error(
    `Runroot requires Node.js ${requiredNodeMajor} or newer. Current version: ${process.versions.node}`,
  );
}

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("Created .env from .env.example");
} else {
  console.log(".env already exists");
}

console.log("Bootstrap completed");
