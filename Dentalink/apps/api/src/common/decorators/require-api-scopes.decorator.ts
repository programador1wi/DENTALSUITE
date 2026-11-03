import type { DeveloperApiScope } from "@dentalwarner/shared";
import { SetMetadata } from "@nestjs/common";

export const API_SCOPES_KEY = "api_scopes";
export const RequireApiScopes = (...scopes: DeveloperApiScope[]) => SetMetadata(API_SCOPES_KEY, scopes);
