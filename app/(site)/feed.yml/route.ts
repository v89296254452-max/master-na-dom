import { ymlServicesFeedResponse } from "@/lib/yml-services-feed";

export const revalidate = 3600;

/** /feed.yml — YML-фид исполнителей для Яндекс.Вебмастера. */
export function GET() {
  return ymlServicesFeedResponse();
}
