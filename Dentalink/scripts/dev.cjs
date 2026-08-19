const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const nodeBin = process.execPath;
const nodeDir = path.dirname(nodeBin);
const isDetached = process.argv.includes("--detached");

const apiPort = Number(process.env.API_PORT ?? 3001);
const webPort = Number(process.env.WEB_PORT ?? 3000);

const processes = [
  {
    name: "api",
    command: nodeBin,
    args: [path.join(rootDir, "node_modules", "@nestjs", "cli", "bin", "nest.js"), "start", "--watch"],
    cwd: path.join(rootDir, "apps", "api"),
    port: apiPort
  },
  {
    name: "web",
    command: nodeBin,
    args: [path.join(rootDir, "node_modules", "vite", "bin", "vite.js"), "--port", String(webPort), "--strictPort"],
    cwd: path.join(rootDir, "apps", "web"),
    port: webPort
  }
];

function buildEnv() {
  const env = {};
  const seen = new Set();

  for (const [key, value] of Object.entries(process.env)) {
    const normalized = key.toLowerCase();
    if (normalized === "path") {
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    env[key] = value;
  }

  const currentPath = process.env.Path ?? process.env.PATH ?? "";
  const pathValue = [nodeDir, path.join(rootDir, "node_modules", ".bin"), currentPath].filter(Boolean).join(path.delimiter);

  if (process.platform === "win32") {
    env.Path = pathValue;
    env.SystemRoot ??= process.env.SystemRoot ?? "C:\\Windows";
    env.WINDIR ??= process.env.WINDIR ?? env.SystemRoot;
    env.ComSpec ??= process.env.ComSpec ?? path.join(env.SystemRoot, "System32", "cmd.exe");
  } else {
    env.PATH = pathValue;
  }

  return env;
}

function assertBinariesExist() {
  const missing = processes.flatMap((proc) => proc.args[0]).filter((binPath) => !fs.existsSync(binPath));
  if (missing.length > 0) {
    console.error("[dev] Missing local dev binaries. Run `npm install` first.");
    for (const binPath of missing) {
      console.error(`[dev] Missing: ${binPath}`);
    }
    process.exit(1);
  }
}

function isPortBusy(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) => {
      resolve(error.code === "EADDRINUSE" || error.code === "EACCES");
    });
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(port, host);
  });
}

async function isAnyLocalPortBusy(port) {
  const hosts = process.platform === "win32" ? ["127.0.0.1", "::1"] : ["127.0.0.1"];
  for (const host of hosts) {
    if (await isPortBusy(port, host)) {
      return true;
    }
  }
  return false;
}

async function getBusyProcesses() {
  const busyProcesses = [];
  for (const proc of processes) {
    if (await isAnyLocalPortBusy(proc.port)) {
      busyProcesses.push(proc);
    }
  }
  return busyProcesses;
}

function reportBusyProcesses(busyProcesses) {
  console.error("[dev] Cannot start because required ports are already in use:");
  for (const proc of busyProcesses) {
    console.error(`[dev] - ${proc.name}: port ${proc.port}`);
  }
  console.error("[dev] Stop the existing process or use `npm run dev:detached` to reuse healthy listeners.");
  if (process.platform === "win32") {
    console.error(
      "[dev] Inspect owner: Get-NetTCPConnection -State Listen -LocalPort <port> | Select-Object LocalPort,OwningProcess"
    );
  }
}

function stopAll(running, exitCode = 0) {
  for (const child of running) {
    child.kill();
  }
  process.exitCode = exitCode;
}

async function startForeground() {
  const busyProcesses = await getBusyProcesses();
  if (busyProcesses.length > 0) {
    reportBusyProcesses(busyProcesses);
    process.exitCode = 1;
    return;
  }

  const running = new Set();
  let shuttingDown = false;

  for (const proc of processes) {
    const child = spawn(proc.command, proc.args, {
      cwd: proc.cwd,
      env: buildEnv(),
      stdio: "inherit",
      windowsHide: true
    });

    running.add(child);

    child.on("exit", (code, signal) => {
      running.delete(child);
      if (!shuttingDown) {
        shuttingDown = true;
        const reason = signal ? `signal ${signal}` : `code ${code}`;
        console.error(`[dev] ${proc.name} exited with ${reason}`);
        stopAll(running, code ?? 1);
      }
    });
  }

  process.on("SIGINT", () => {
    shuttingDown = true;
    stopAll(running, 0);
  });
  process.on("SIGTERM", () => {
    shuttingDown = true;
    stopAll(running, 0);
  });
}

async function startDetached() {
  const logDir = path.join(rootDir, "logs");
  fs.mkdirSync(logDir, { recursive: true });

  for (const proc of processes) {
    if (await isAnyLocalPortBusy(proc.port)) {
      console.log(`[dev] ${proc.name} already appears to be listening on port ${proc.port}; skipping.`);
      continue;
    }

    const outPath = path.join(logDir, `${proc.name}.out.log`);
    const errPath = path.join(logDir, `${proc.name}.err.log`);
    const out = fs.openSync(outPath, "w");
    const err = fs.openSync(errPath, "w");

    const child = spawn(proc.command, proc.args, {
      cwd: proc.cwd,
      detached: true,
      env: buildEnv(),
      stdio: ["ignore", out, err],
      windowsHide: true
    });

    child.unref();
    console.log(`[dev] started ${proc.name} pid=${child.pid} port=${proc.port}`);
    console.log(`[dev] ${proc.name} logs: ${outPath} / ${errPath}`);
  }
}

assertBinariesExist();

if (isDetached) {
  startDetached().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  startForeground().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
