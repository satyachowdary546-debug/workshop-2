// Shared todo logic + JSON-file storage. Used by both the REST API and the MCP tools.
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const DATA_FILE = path.join(__dirname, "todos.json");
const VALID_STATUSES = ["pending", "in-progress", "completed"];

class ValidationError extends Error {}
class NotFoundError extends Error {}

// ---------- JSON storage helpers ----------
async function readTodos() {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeTodos(todos) {
  await fs.writeFile(DATA_FILE, JSON.stringify(todos, null, 2), "utf8");
}

// Serialize read-modify-write operations so concurrent requests don't clobber each other
let queue = Promise.resolve();
function withLock(fn) {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
}

function assertValidStatus(status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new ValidationError(`'status' must be one of: ${VALID_STATUSES.join(", ")}`);
  }
}

// ---------- Operations ----------
function addTodo({ name, status = "pending" }) {
  if (typeof name !== "string" || !name.trim()) {
    throw new ValidationError("'name' is required and must be a non-empty string");
  }
  assertValidStatus(status);

  return withLock(async () => {
    const todos = await readTodos();
    const todo = { id: crypto.randomUUID(), name: name.trim(), status };
    todos.push(todo);
    await writeTodos(todos);
    return todo;
  });
}

async function listTodos({ status } = {}) {
  if (status !== undefined) assertValidStatus(status);
  const todos = await readTodos();
  return status ? todos.filter((t) => t.status === status) : todos;
}

function updateTodoStatus(id, status) {
  assertValidStatus(status);

  return withLock(async () => {
    const todos = await readTodos();
    const todo = todos.find((t) => t.id === id);
    if (!todo) throw new NotFoundError("Todo not found");
    todo.status = status;
    await writeTodos(todos);
    return todo;
  });
}

function deleteTodo(id) {
  return withLock(async () => {
    const todos = await readTodos();
    const index = todos.findIndex((t) => t.id === id);
    if (index === -1) throw new NotFoundError("Todo not found");
    const [removed] = todos.splice(index, 1);
    await writeTodos(todos);
    return removed;
  });
}

module.exports = {
  VALID_STATUSES,
  ValidationError,
  NotFoundError,
  addTodo,
  listTodos,
  updateTodoStatus,
  deleteTodo,
};
