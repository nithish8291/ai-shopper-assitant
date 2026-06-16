import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

let client: Client | null = null;
let connecting: Promise<Client> | null = null;

export async function getMCPClient(): Promise<Client> {
  if (client) return client;

  // Prevent race conditions from parallel requests
  if (connecting) return connecting;

  connecting = (async () => {
    const transport = new StreamableHTTPClientTransport(
      new URL(process.env.MCP_SERVER_URL || "http://localhost:3000/mcp")
    );

    const newClient = new Client({
      name: "ai-shopper-assistant",
      version: "1.0.0",
    });

    await newClient.connect(transport);
    client = newClient;
    connecting = null;
    return client;
  })();

  try {
    return await connecting;
  } catch (err) {
    connecting = null;
    client = null;
    throw err;
  }
}

export async function callMCPTool(
  toolName: string,
  args: Record<string, unknown>
) {
  try {
    const mcpClient = await getMCPClient();
    return await mcpClient.callTool({
      name: toolName,
      arguments: args,
    });
  } catch (err) {
    // Reset client on failure so next attempt reconnects
    client = null;
    connecting = null;
    throw err;
  }
}

export async function listMCPTools() {
  const mcpClient = await getMCPClient();

  const tools = await mcpClient.listTools();

  return tools.tools;
}