const { spawn } = require("node:child_process");

const processes = [
  {
    name: "api",
    command: "npm run start:dev --workspace=@dentalwarner/api"
  },
  {
    name: "web",
    command: "npm run dev --workspace=@dentalwarner/web"
  }
];

const running = new Set();
let shuttingDown = false;

function stopAll(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of running) {
    child.kill();
  }
  process.exitCode = exitCode;
}

for (const proc of processes) {
  const child = spawn(proc.command, {
    stdio: "inherit",
    shell: true
  });

  running.add(child);

  child.on("exit", (code, signal) => {
    running.delete(child);
    if (!shuttingDown) {
      const reason = signal ? `signal ${signal}` : `code ${code}`;
      console.error(`[dev] ${proc.name} exited with ${reason}`);
      stopAll(code ?? 1);
    }
  });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
