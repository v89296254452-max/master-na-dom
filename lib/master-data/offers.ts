import type { VkAccountGroup } from "@/lib/vk-types";
import { ACCOUNT_GROUP_TO_TEMPLATE_LABEL } from "@/lib/vk-content-templates-types";
import type { MasterOffer } from "./types";

export const MASTER_OFFERS: MasterOffer[] = [
  { id: "kp", label: "КП — компьютерная помощь", templateLabel: ACCOUNT_GROUP_TO_TEMPLATE_LABEL.kp },
  { id: "mnch", label: "МнЧ — мастер на час", templateLabel: ACCOUNT_GROUP_TO_TEMPLATE_LABEL.mnch },
  { id: "bt", label: "БТ — бытовая техника", templateLabel: ACCOUNT_GROUP_TO_TEMPLATE_LABEL.bt },
];

export function getMasterOffers(): MasterOffer[] {
  return MASTER_OFFERS;
}

export function getOfferLabel(group: VkAccountGroup): string {
  return MASTER_OFFERS.find((o) => o.id === group)?.label ?? group;
}

export function isVkAccountGroup(value: string): value is VkAccountGroup {
  return value === "kp" || value === "bt" || value === "mnch";
}
