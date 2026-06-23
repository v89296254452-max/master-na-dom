export const VK_API_DIAGNOSTIC_METHODS = [
  "users.get",
  "groups.get",
  "groups.getById",
  "groups.create",
  "groups.edit",
  "groups.editAddress",
  "wall.post",
] as const;

export type VkApiDiagnosticMethod = (typeof VK_API_DIAGNOSTIC_METHODS)[number];

export const VK_API_DIAGNOSTIC_METHOD_LABELS: Record<VkApiDiagnosticMethod, string> = {
  "users.get": "users.get",
  "groups.get": "groups.get",
  "groups.getById": "groups.getById",
  "groups.create": "groups.create (тест)",
  "groups.edit": "groups.edit",
  "groups.editAddress": "groups.editAddress (screen_name)",
  "wall.post": "wall.post",
};

export interface VkApiDiagnosticRequest {
  method: string;
  url: string;
  params: Record<string, string>;
}

export interface VkApiDiagnosticVkError {
  code?: number;
  message: string;
}

export interface VkApiDiagnosticStepResult {
  method: VkApiDiagnosticMethod;
  label: string;
  request: VkApiDiagnosticRequest;
  response: unknown;
  rawBody?: unknown;
  vkError: VkApiDiagnosticVkError | null;
  httpError: string | null;
  durationMs: number;
  success: boolean;
  note?: string;
}

export interface VkGroupsCreateTestResult {
  accountId: string;
  accountName: string;
  ranAt: string;
  step: VkApiDiagnosticStepResult;
}

export interface VkExistingGroupTestResult {
  accountId: string;
  accountName: string;
  vkGroupId: string;
  ranAt: string;
  steps: VkApiDiagnosticStepResult[];
}

export interface VkResolveUrlTestResult {
  accountId: string;
  accountName: string;
  vkUrl: string;
  ranAt: string;
  resolve: {
    vkUrl: string;
    vkGroupId: string;
    screenName: string;
    type: string;
    resolved: boolean;
    error: string;
    resolveScreenNameResponse: unknown;
  };
}

export interface VkApiDiagnosticsRunResult {
  accountId: string;
  accountName: string;
  ranAt: string;
  steps: VkApiDiagnosticStepResult[];
}
