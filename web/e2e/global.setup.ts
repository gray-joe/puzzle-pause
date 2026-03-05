import { test as setup } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";

setup("seeding puzzle database", async ({}) => {
  console.log("seeding puzzle database...");
  execSync("python seed_dev.py", {
    cwd: path.resolve(__dirname, "../../backend"),
    env: {
      ...process.env,
      DATABASE_URL: `sqlite:///${path.resolve(__dirname, "../../data/puzzle.db")}`,
    },
    stdio: "inherit",
  });
});
