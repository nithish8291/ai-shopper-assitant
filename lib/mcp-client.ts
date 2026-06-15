import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

let client: Client | null = null;

export async function getMCPClient(): Promise<Client> {
  if (client) return client;

  const transport = new StreamableHTTPClientTransport(
    new URL(process.env.MCP_SERVER_URL || "http://localhost:3000/mcp")
  );

  client = new Client({
    name: "ai-shopper-assistant",
    version: "1.0.0",
  });

  await client.connect(transport);

  return client;
}

export async function callMCPTool(
  toolName: string,
  args: Record<string, unknown>
) {
  const mcpClient = await getMCPClient();

  return await mcpClient.callTool({
    name: toolName,
    arguments: args,
  });
}

export async function listMCPTools() {
  const mcpClient = await getMCPClient();

  const tools = await mcpClient.listTools();

  return tools.tools;
}