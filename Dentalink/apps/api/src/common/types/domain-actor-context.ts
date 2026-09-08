import type { AuthUser } from "./auth-user";

export type DomainActorContext = AuthUser & {
  domainActor?:
    | { type: "USER"; userId: string }
    | { type: "API_KEY"; apiKeyId: string };
};

export function domainActorAuditFields(actor: DomainActorContext) {
  return actor.domainActor?.type === "API_KEY"
    ? { actorUserId: null, actorApiKeyId: actor.domainActor.apiKeyId }
    : { actorUserId: actor.id, actorApiKeyId: null };
}
