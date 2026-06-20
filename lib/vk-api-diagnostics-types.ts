export const VK_API_DIAGNOSTIC_METHODS = [
  "users.get",
  "groups.get",
  "groups.create",
  "groups.edit",
  "wall.post",
] as const;

export type VkApiDiagnosticMethod = (typeof VK_API_DIAGNOSTIC_METHODS)[number];

export const VK_API_DIAGNOSTIC_METHOD_LABELS: Record<VkApiDiagnosticMethod, string> = {
  "users.get": "users.get",
  "groups.get": "groups.get",
  "groups.create": "groups.create (тест)",
  "groups.edit": "groups.edit",
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
  vkError: VkApiDiagnosticVkError | null;
  httpError: string | null;
  durationMs: number;
  success: boolean;
  note?: string;
}

export interface VkApiDiagnosticsRunResult {
  accountId: string;
  accountName: string;
  ranAt: string;
  steps: VkApiDiagnosticStepResult[];
}
