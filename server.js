const express = require("express");
const https = require("https");
const fs = require("fs");
const path = require("path");

const store = require("./todoStore");
const { handleMcpRequest, methodNotAllowed } = require("./mcp");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Maps store errors to HTTP responses
function handleError(err, res, next) {
  if (err instanceof store.ValidationError) return res.status(400).json({ error: err.message });
  if (err instanceof store.NotFoundError) return res.status(404).json({ error: err.message });
  next(err);
}

// ---------- REST API ----------

// Add todo
app.post("/todos", async (req, res, next) => {
  try {
    res.status(201).json(await store.addTodo(req.body));
  } catch (err) {
    handleError(err, res, next);
  }
});

// List todos (optional filter: /todos?status=pending)
app.get("/todos", async (req, res, next) => {
  try {
    res.json(await store.listTodos({ status: req.query.status }));
  } catch (err) {
    handleError(err, res, next);
  }
});

// Update status of a todo
app.patch("/todos/:id/status", async (req, res, next) => {
  try {
    res.json(await store.updateTodoStatus(req.params.id, req.body.status));
  } catch (err) {
    handleError(err, res, next);
  }
});

// Delete todo
app.delete("/todos/:id", async (req, res, next) => {
  try {
    res.json({ message: "Todo deleted", todo: await store.deleteTodo(req.params.id) });
  } catch (err) {
    handleError(err, res, next);
  }
});

// ---------- MCP endpoint (for AI agents) ----------
app.post("/mcp", handleMcpRequest);
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

// ---------- Error handling ----------
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// ---------- Server ----------
// USE_HTTP=true -> plain HTTP (use this behind a tunnel/reverse proxy that provides HTTPS)

app.listen(PORT, () => {
  console.log(`REST API:   http://localhost:${PORT}/todos`);
  console.log(`MCP server: http://localhost:${PORT}/mcp`);
  console.log("Plain HTTP mode - expose it via an HTTPS tunnel/proxy.");
});
