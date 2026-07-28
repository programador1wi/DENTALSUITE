import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { AuthUser } from "../types/auth-user";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Authenticated user is required");
    }

    if (user.permissions.includes("system.manage_all")) {
      return true;
    }

    const legacyAliases: Record<string, string[]> = {
      "price_list.view": ["price_lists.read"],
      "price_list.create": ["price_lists.create"],
      "price_list.edit_draft": ["price_lists.update"],
      "price_list.publish": ["price_lists.update"],
      "price_list.schedule": ["price_lists.update"],
      "price_list.deactivate": ["price_lists.deactivate"],
      "price_list.compare_versions": ["price_lists.read"],
      "price_list.import": ["price_lists.update"],
      "price_list.export": ["price_lists.read"],
      "procedure.view": ["procedures.read"],
      "procedure.create": ["procedures.create"],
      "procedure.edit": ["procedures.update"],
      "procedure.deactivate": ["procedures.deactivate"],
      "price_template.view": ["price_lists.read"],
      "price_template.manage": ["price_lists.update"],
      "price_override.apply": ["price_lists.override_manual"],
      "laboratory_price.view": ["price_lists.read"],
      "laboratory_price.edit": ["price_lists.update"],
      "price_audit.view": ["price_lists.read"],
      "treatment_discount.apply": ["treatment_plans.update"],
      "treatment_discount.view": ["treatment_plans.read"],
      "expenses.read": ["settings.read"],
      "expenses.create": ["settings.update"],
      "expenses.update": ["settings.update"],
      "expenses.void": ["settings.update"]
      ,"agreements.debt_report.read": ["settings.read", "agreements.read"]
      ,"agreements.debt_report.all_branches": ["branches.view_all"]
      ,"agreements.payments.create": ["settings.update", "payments.create"]
      ,"agreements.payments.approve": ["settings.update", "payments.allocate"]
      ,"agreements.payments.void": ["settings.update", "payments.void"]
      ,"agreements.reports.export": ["settings.read", "reports.export"]
      ,"consents.templates.read": ["consent_templates.read"]
      ,"consents.templates.create": ["consent_templates.create"]
      ,"consents.templates.update_draft": ["consent_templates.update"]
      ,"consents.templates.publish": ["consent_templates.update"]
      ,"consents.templates.deactivate": ["consent_templates.deactivate"]
      ,"consents.templates.view_versions": ["consent_templates.read"]
      ,"consents.templates.view_audit": ["consent_templates.read"]
      ,"consents.instances.read": ["consents.read"]
      ,"consents.instances.create": ["consents.create"]
      ,"consents.instances.complete_fields": ["consents.create", "consents.sign"]
      ,"consents.instances.sign_patient": [
        "consents.sign",
        "consents.instances.sign_professional",
        "consents.instances.sign_representative"
      ]
      ,"consents.instances.finalize": ["consents.sign"]
      ,"consents.instances.void": ["consents.sign"]
      ,"consents.instances.download": ["consents.pdf"]
      ,"consents.instances.view_evidence": ["consents.pdf", "consents.read"]
      ,"patient_analytics.read": ["patients.read", "reports.read"]
      ,"patient_analytics.read_financial": ["payments.read", "accounts_receivable.read"]
      ,"patient_analytics.view_all_branches": ["branches.view_all", "reports.read"]
      ,"patient_analytics.export": ["reports.export"]
      ,"patient_analytics.refresh": ["reports.read"]
      ,"patient_analytics.view_patient_details": ["patients.read"]
    };
    const allowed = required.every(
      (permission) =>
        user.permissions.includes(permission) ||
        (legacyAliases[permission] ?? []).some((alias) => user.permissions.includes(alias))
    );
    if (!allowed) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
