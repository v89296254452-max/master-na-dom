import { getPhone, getAllPages } from "@/lib/pages";
import { normalizePhone } from "@/lib/vk-automation/import-normalize";
import { readVkTasksFile } from "@/lib/vk-tasks";
import type { MasterPhone } from "./types";
import { getMasterDataSource } from "./source";

export function getPhonesFromSeo(): MasterPhone[] {
  const seen = new Map<string, MasterPhone>();
  for (const page of getAllPages()) {
    const phone = getPhone(page.phone);
    const normalized = normalizePhone(phone);
    if (!normalized) continue;
    if (!seen.has(normalized)) {
      seen.set(normalized, {
        phone,
        normalized,
        city: page.city,
        offerGroup: undefined,
      });
    }
  }
  return [...seen.values()];
}

export function getPhonesFromVkTasks(): MasterPhone[] {
  const seen = new Map<string, MasterPhone>();
  for (const task of readVkTasksFile()) {
    const phone = getPhone(task.phone);
    const normalized = normalizePhone(phone);
    if (!normalized) continue;
    seen.set(normalized, {
      phone,
      normalized,
      city: task.city,
      offerGroup: task.accountGroup,
    });
  }
  return [...seen.values()];
}

export function getPhones(): MasterPhone[] {
  const source = getMasterDataSource();
  const map = new Map<string, MasterPhone>();

  if (source === "project") {
    for (const p of getPhonesFromVkTasks()) {
      map.set(p.normalized, p);
    }
    for (const p of getPhonesFromSeo()) {
      if (!map.has(p.normalized)) map.set(p.normalized, p);
    }
  } else {
    for (const p of getPhonesFromSeo()) {
      map.set(p.normalized, p);
    }
    for (const p of getPhonesFromVkTasks()) {
      if (!map.has(p.normalized)) map.set(p.normalized, p);
    }
  }

  return [...map.values()];
}
