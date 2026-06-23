import { getKey, setKey } from "@/lib/vk-automation/db";
import { MASTER_DATA_SOURCE_LABELS, type MasterDataSource } from "./types";

const DATA_SOURCE_KEY = "master_data_source";

export function getMasterDataSource(): MasterDataSource {
  const value = getKey(DATA_SOURCE_KEY);
  if (value === "legacy") return "legacy";
  return "project";
}

export function setMasterDataSource(source: MasterDataSource): void {
  setKey(DATA_SOURCE_KEY, source);
}

export function getActiveSourceLabel(): string {
  return MASTER_DATA_SOURCE_LABELS[getMasterDataSource()];
}
