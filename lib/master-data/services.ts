import { getAllPages, getServiceSlug } from "@/lib/pages";
import { getAccountGroup } from "@/lib/vk-generator";
import type { VkAccountGroup } from "@/lib/vk-types";
import { normalizeServiceName } from "@/lib/vk-automation/import-normalize";
import { listTasks as listBrowserTasks } from "@/lib/vk-automation/db";
import type { MasterService } from "./types";
import { getMasterDataSource } from "./source";

export function getSeoServices(): MasterService[] {
  const seen = new Map<string, MasterService>();
  for (const page of getAllPages()) {
    const slug = getServiceSlug(page);
    if (!slug) continue;
    const key = slug.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, {
        name: page.service,
        slug,
        offerGroup: getAccountGroup(page),
      });
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function getLegacyServices(): MasterService[] {
  const tasks = listBrowserTasks(5000);
  const seen = new Map<string, MasterService>();
  for (const task of tasks) {
    const payload = task.payload;
    const service = normalizeServiceName(String(payload.service ?? task.groupName ?? ""));
    if (!service) continue;
    const slug = String(payload.slug ?? service).toLowerCase();
    if (!seen.has(slug)) {
      seen.set(slug, {
        name: service,
        slug,
        offerGroup: (payload.offerGroup as VkAccountGroup) ?? "mnch",
      });
    }
  }
  return [...seen.values()];
}

export function getMasterServices(source?: import("./types").MasterDataSource): MasterService[] {
  const mode = source ?? getMasterDataSource();
  if (mode === "legacy") {
    const map = new Map<string, MasterService>();
    for (const s of [...getSeoServices(), ...getLegacyServices()]) {
      map.set(s.slug.toLowerCase(), s);
    }
    return [...map.values()];
  }
  return getSeoServices();
}
