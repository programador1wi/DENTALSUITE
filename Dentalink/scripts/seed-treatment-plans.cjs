/**
 * Script: Genera planes de tratamiento para citas que no tienen uno asociado.
 * Busca pacientes, luego sus citas, y crea planes de tratamiento donde falten.
 *
 * Uso: node scripts/seed-treatment-plans.cjs
 */
const http = require("http");

const API_BASE = "http://127.0.0.1:3001/api/v1";
const ADMIN_EMAIL = "admin@dentalwarner.local";
const ADMIN_PASSWORD = "Admin123!";

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function extractArray(res) {
  if (Array.isArray(res.data)) return res.data;
  if (res.data?.data && Array.isArray(res.data.data)) return res.data.data;
  if (res.data?.items && Array.isArray(res.data.items)) return res.data.items;
  return [];
}

async function main() {
  console.log("🔐 Autenticando...");
  const loginRes = await request("POST", "/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (loginRes.status !== 200 && loginRes.status !== 201) {
    console.error("❌ Error de login:", loginRes.data);
    process.exit(1);
  }
  const token = loginRes.data.accessToken;
  console.log("✅ Autenticado correctamente.\n");

  // 1. Obtener pacientes
  console.log("👥 Obteniendo pacientes...");
  const patientsRes = await request("GET", "/patients?pageSize=100", null, token);
  if (patientsRes.status !== 200) {
    console.error("❌ Error obteniendo pacientes:", patientsRes.data);
    process.exit(1);
  }
  const patients = extractArray(patientsRes);
  console.log(`   Total de pacientes: ${patients.length}\n`);

  let totalCreated = 0;

  // 2. Para cada paciente, obtener sus citas
  for (const patient of patients) {
    const patientName = `${patient.firstName} ${patient.lastName}`;
    const apptRes = await request("GET", `/appointments?patientId=${patient.id}`, null, token);
    if (apptRes.status !== 200) {
      console.log(`   ⚠️  Error obteniendo citas de ${patientName}, saltando.`);
      continue;
    }

    const appointments = extractArray(apptRes);
    if (!appointments.length) continue;

    const withoutPlan = appointments.filter((a) => !a.treatmentPlanId);
    if (!withoutPlan.length) continue;

    console.log(`📋 Paciente: ${patientName} — ${withoutPlan.length} cita(s) sin plan`);

    for (const appointment of withoutPlan) {
      // 3. Crear plan de tratamiento
      const planRes = await request("POST", "/treatment-plans", {
        branchId: appointment.branchId,
        patientId: patient.id,
        professionalId: appointment.professionalId,
        name: `Plan de Tratamiento - ${patientName}`,
        description: `Plan generado para la cita del ${new Date(appointment.startAt).toLocaleDateString("es-MX")}`,
        status: "DRAFT"
      }, token);

      if (planRes.status !== 200 && planRes.status !== 201) {
        console.error(`   ❌ Error creando plan:`, planRes.data?.message ?? planRes.data);
        continue;
      }

      const plan = planRes.data;

      // 4. Asociar el plan a la cita
      const updateRes = await request("PATCH", `/appointments/${appointment.id}`, {
        treatmentPlanId: plan.id
      }, token);

      if (updateRes.status !== 200) {
        console.error(`   ❌ Error vinculando plan a cita:`, updateRes.data?.message ?? updateRes.data);
        continue;
      }

      totalCreated++;
      console.log(`   ✅ Plan ${plan.id.slice(-6)} → Cita ${appointment.id.slice(-6)}`);
    }
    console.log();
  }

  console.log(`🎉 Proceso completado. ${totalCreated} plan(es) de tratamiento creado(s) y vinculado(s).`);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
