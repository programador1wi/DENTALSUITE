import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { AuthService } from "../modules/auth/auth.service";
import { PrismaService } from "../database/prisma.service";

type Options = Record<string, string | boolean>;

function parseArgs(argv: string[]) {
  const values: Options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) throw new Error(`Argumento no reconocido: ${item}`);
    const key = item.slice(2);
    if (key.toLowerCase().includes("password")) {
      throw new Error("La contraseña solo puede proporcionarse mediante el prompt oculto");
    }
    if (key === "execute") {
      values[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Falta valor para --${key}`);
    values[key] = value;
    index += 1;
  }
  return values;
}

function required(options: Options, key: string) {
  const value = options[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Falta --${key}`);
  return value.trim();
}

async function promptSecret(label: string) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("La creación requiere una terminal interactiva para leer la contraseña sin mostrarla");
  }
  process.stdout.write(label);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise<string>((resolve, reject) => {
    let value = "";
    const finish = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdout.write("\n");
    };
    const onData = (chunk: string) => {
      if (chunk === "\u0003") {
        finish();
        reject(new Error("Operación cancelada"));
      } else if (chunk === "\r" || chunk === "\n") {
        finish();
        resolve(value);
      } else if (chunk === "\u007f" || chunk === "\b") {
        value = value.slice(0, -1);
      } else if (!chunk.startsWith("\u001b")) {
        value += chunk;
      }
    };
    process.stdin.on("data", onData);
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const input = {
    organizationName: required(options, "name"),
    branchName: required(options, "branch"),
    adminEmail: required(options, "admin-email").toLowerCase(),
    adminFirstName: required(options, "admin-first-name"),
    adminLastName: required(options, "admin-last-name"),
    branchTimezone: typeof options.timezone === "string" ? options.timezone : "America/Mexico_City"
  };

  process.stdout.write(`${JSON.stringify({ mode: options.execute ? "execute" : "preview", ...input }, null, 2)}\n`);
  if (!options.execute) {
    process.stdout.write("Vista previa completa. Repita con --execute para crear la organización.\n");
    return;
  }

  const adminPassword = await promptSecret("Contraseña inicial del SUPERADMIN: ");
  if (adminPassword.length < 12) throw new Error("La contraseña debe tener al menos 12 caracteres");

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const auth = app.get(AuthService);
    const prisma = app.get(PrismaService);
    const result = await auth.registerOrganization({ ...input, adminPassword }, {});
    await prisma.session.updateMany({
      where: { userId: result.user.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    process.stdout.write(`${JSON.stringify({
      created: true,
      organizationId: result.user.organizationId,
      adminUserId: result.user.id,
      adminEmail: result.user.email
    }, null, 2)}\n`);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Error de aprovisionamiento";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
