import { proxyAgentChatAction } from "../action-proxy";

export function POST(request: Request) {
  return proxyAgentChatAction(request, "confirm");
}
