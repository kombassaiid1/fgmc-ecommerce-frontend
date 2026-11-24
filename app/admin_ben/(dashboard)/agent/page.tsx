import { AgentFullPage } from "@/components/agent/agent-full-page";
import { getAgentCommercialName } from "@/lib/agent-commercial-name";

export default function AdminAgentPage() {
  return <AgentFullPage agentName={getAgentCommercialName()} />;
}
