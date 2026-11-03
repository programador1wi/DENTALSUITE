CREATE TABLE "PermissionProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "PermissionProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PermissionProfileEntry" (
    "profileId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "PermissionProfileEntry_pkey" PRIMARY KEY ("profileId","permissionId")
);

CREATE UNIQUE INDEX "PermissionProfile_organizationId_name_key" ON "PermissionProfile"("organizationId", "name");
CREATE INDEX "PermissionProfile_organizationId_isActive_idx" ON "PermissionProfile"("organizationId", "isActive");

ALTER TABLE "PermissionProfile" ADD CONSTRAINT "PermissionProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PermissionProfileEntry" ADD CONSTRAINT "PermissionProfileEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PermissionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PermissionProfileEntry" ADD CONSTRAINT "PermissionProfileEntry_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
