// Exposes the todo operations as MCP tools for AI agents.
// Mounted by server.js at POST /mcp (Streamable HTTP transport, stateless).
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { z } = require("zod");
const store = require("./todoStore");

const statusSchema = z.enum(store.VALID_STATUSES);

// Wraps a store call so results/errors come back in MCP tool-result format
async function run(fn) {
  try {
    const result = await fn();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    if (err instanceof store.ValidationError || err instanceof store.NotFoundError) {
      return { isError: true, content: [{ type: "text", text: err.message }] };
    }
    console.error(err);
    return { isError: true, content: [{ type: "text", text: "Internal server error" }] };
  }
}

function createMcpServer() {
  const server = new McpServer({ name: "todo-mcp-server", version: "1.0.0" });

  server.registerTool(
    "add_todo",
    {
      title: "Add todo",
      description: "Create a new todo item. Returns the created todo including its generated id.",
      inputSchema: {
        name: z.string().min(1).describe("Name/description of the todo"),
        status: statusSchema.optional().describe("Initial status (defaults to 'pending')"),
      },
    },
    ({ name, status }) => run(() => store.addTodo({ name, status }))
  );

  server.registerTool(
    "list_todos",
    {
      title: "List todos",
      description: "List todos. Optionally filter by status.",
      inputSchema: {
        status: statusSchema.optional().describe("Only return todos with this status"),
      },
    },
    ({ status }) => run(() => store.listTodos({ status }))
  );

  server.registerTool(
    "update_todo_status",
    {
      title: "Update todo status",
      description: "Change the status of an existing todo, identified by its id.",
      inputSchema: {
        id: z.string().describe("Id of the todo (from add_todo or list_todos)"),
        status: statusSchema.describe("New status"),
      },
    },
    ({ id, status }) => run(() => store.updateTodoStatus(id, status))
  );

  server.registerTool(
    "delete_todo",
    {
      title: "Delete todo",
      description: "Permanently delete a todo by its id.",
      inputSchema: {
        id: z.string().describe("Id of the todo to delete"),
      },
    },
    ({ id }) => run(() => store.deleteTodo(id))
  );

  return server;
}

// Express handler. Stateless mode: a fresh server + transport per request.
async function handleMcpRequest(req, res) {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
}

// Stateless server has no SSE stream / sessions, so GET and DELETE aren't supported
function methodNotAllowed(req, res) {
  res.status(405).set("Allow", "POST").json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
}

module.exports = { createMcpServer, handleMcpRequest, methodNotAllowed };
