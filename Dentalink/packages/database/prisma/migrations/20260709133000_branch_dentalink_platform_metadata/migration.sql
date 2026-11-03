ALTER TABLE "Branch"
ADD COLUMN "dentalinkPlatformCode" TEXT,
ADD COLUMN "dentalinkSucursalId" INTEGER,
ADD COLUMN "dentalinkSucursalName" TEXT;

CREATE UNIQUE INDEX "Branch_organizationId_dentalinkPlatformCode_dentalinkSucursalId_key"
ON "Branch"("organizationId", "dentalinkPlatformCode", "dentalinkSucursalId");

CREATE INDEX "Branch_organizationId_dentalinkPlatformCode_idx"
ON "Branch"("organizationId", "dentalinkPlatformCode");

WITH branch_map("code", "platformCode", "sucursalId", "sucursalName", "isActive") AS (
  VALUES
    ('MEXICALI', 'NORTE', 1, 'Dental + Suc. Mexicali', true),
    ('LEON', 'NORTE', 2, 'Dental + Suc. Leon', true),
    ('SUCURSAL_LEON_INACTIVA', 'NORTE', 3, 'SUCURSAL LEON', false),
    ('SAN_LUIS_RIO', 'NORTE', 4, 'Dental + Suc. San Luis Rio', true),
    ('NORTE_VILLAHERMOSA_INACTIVA', 'NORTE', 5, 'Dental + Suc. Villahermosa', false),
    ('PLAYA_DEL_CARMEN', 'NORTE', 6, 'Dental + Suc. Playa del Carmen', true),
    ('CANCUN', 'NORTE', 7, 'Dental + Suc. Cancun', true),
    ('AGUASCALIENTES', 'NORTE', 8, 'Dental + Suc. Aguascalientes', true),
    ('SAN_LUIS_POTOSI', 'NORTE', 9, 'Dental + Suc. San Luis Potosi', true),
    ('PUERTO_VALLARTA', 'NORTE', 10, 'Dental + Suc. Puerto Vallarta', true),
    ('CONDESA', 'NORTE', 11, 'Dental + Suc. Condesa', true),
    ('DURANGO', 'NORTE', 12, 'Dental + Suc. Durango', true),
    ('LEON_VALLE', 'NORTE', 13, 'Dental + Suc. Leon Valle', true),
    ('TUXTLA', 'SUR', 1, 'Dental + Suc. Tuxtla', true),
    ('GUADALAJARA', 'SUR', 2, 'Dental + Suc. Guadalajara', true),
    ('TAPACHULA', 'SUR', 3, 'Dental + Suc. Tapachula', true),
    ('SAN_CRISTOBAL', 'SUR', 4, 'Dental + Suc. San Cristobal', true),
    ('DXRAY_TUXTLA', 'SUR', 5, 'DX-RAY TUXTLA', true),
    ('VILLAHERMOSA', 'SUR', 6, 'Dental + Suc. Villahermosa', true),
    ('PACHUCA', 'SUR', 7, 'Dental + Suc. Pachuca', true),
    ('TONALA', 'SUR', 8, 'Dental + Suc. Tonala', true),
    ('COMITAN', 'SUR', 9, 'Dental + Suc. Comitan', true),
    ('CORDOBA_VER', 'SUR', 10, 'Dental + Suc. Cordoba Veracruz', true),
    ('TUXPAN', 'SUR', 11, 'Dental + Suc. Tuxpan', true),
    ('ATLIXCO', 'SUR', 12, 'Dental + Suc. Atlixco', true),
    ('XALAPA', 'SUR', 13, 'Dental + Suc. Xalapa', true),
    ('MERIDA', 'SUR', 14, 'Dental + Suc. Merida', true),
    ('CAMPECHE', 'SUR', 15, 'Dental + Suc. Campeche', true),
    ('JWARNER_ESPECIALIDADES_TUXTLA', 'DJWARNER', 1, 'Dental J.Warner ESPECIALIDADES TUXTLA', true),
    ('DJWARNER_11_PTE', 'DJWARNER', 2, '11 Pte', true),
    ('JWARNER_9NA_SUR', 'DJWARNER', 3, 'Dental J.Warner 9NA SUR', true),
    ('DJWARNER_PICHANCHAS', 'DJWARNER', 4, 'PICHANCHAS', true),
    ('DJWARNER_MERIDA_CENTRO', 'DJWARNER', 5, 'Merida centro', true),
    ('DJWARNER_GUADALAJARA_PLAZA_DEL_SOL', 'DJWARNER', 6, 'Guadalajara Plaza Del Sol', true),
    ('DJWARNER_MERIDA_POCITO', 'DJWARNER', 7, 'Merida Pocito', true),
    ('DJWARNER_SAN_CRISTOBAL', 'DJWARNER', 8, 'San Cristobal', true),
    ('REAL_DEL_BOSQUE', 'DJWARNER', 9, 'Dental + Real Del Bosque', true),
    ('DJWARNER_TONALA', 'DJWARNER', 10, 'TONALA', true),
    ('DJWARNER_HUIXTLA', 'DJWARNER', 11, 'HUIXTLA', true),
    ('JWARNER_PAULINO_NAVARRO', 'DJWARNER', 12, 'Dental J.Warner Paulino Navarro', true),
    ('DJWARNER_PERIFERICO', 'DJWARNER', 13, 'PERIFERICO', true),
    ('VILLAFLORES', 'DJWARNER', 14, 'Dental + Suc. Villaflores', true),
    ('LAURELES', 'DJWARNER', 15, 'Dental + Suc Laureles', true),
    ('DJWARNER_CACAHOATAN', 'DJWARNER', 16, 'CACAHOATAN', true),
    ('PACHUCA_SELECT', 'DJWARNER', 17, 'Dental+ Pachuca Select', true),
    ('DJWARNER_HERMOSILLO_CENTRO', 'DJWARNER', 18, 'HERMOSILLO CENTRO', true),
    ('JWARNER_VILLAHERMOSA', 'DJWARNER', 19, 'Dental J.Warner Villahermosa', true),
    ('DJWARNER_INSTITUTIONAL', 'DJWARNER', 20, 'WARNER INSTITUTIONAL', true),
    ('DJWARNER_DXRAY', 'DJWARNER', 21, 'DX-RAY', true),
    ('DJWARNER_PLACEHOLDER_22', 'DJWARNER', 22, '.', false)
)
UPDATE "Branch" b
SET
  "dentalinkPlatformCode" = branch_map."platformCode",
  "dentalinkSucursalId" = branch_map."sucursalId",
  "dentalinkSucursalName" = branch_map."sucursalName",
  "isActive" = branch_map."isActive",
  "status" = CASE WHEN branch_map."isActive" THEN 'ACTIVE'::"BranchStatus" ELSE 'INACTIVE'::"BranchStatus" END,
  "zoneId" = z."id",
  "updatedAt" = now()
FROM branch_map, "BranchZone" z
WHERE b."code" = branch_map."code"
  AND z."organizationId" = b."organizationId"
  AND z."code" = branch_map."platformCode";
