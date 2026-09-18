import { ymlServicesFeedResponse } from "@/lib/yml-services-feed";

export const revalidate = 3600;

/** Алиас /offers.yml → тот же YML, что и /feed.yml. */
export function GET() {
  return ymlServicesFeedResponse();
}
