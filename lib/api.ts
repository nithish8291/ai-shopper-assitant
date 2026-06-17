import { v4 as uuid } from "uuid";
export async function sendMessage(message: string, sessionId?: string) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, sessionId: sessionId || getSessionId() }),
  });

  return res.json();
}

function getSessionId(): string {
  if (typeof window === "undefined") return "server-session";
  let id = localStorage.getItem("shopping-session-id");
  if (!id) {
    id = uuid();
    localStorage.setItem("shopping-session-id", id);
  }
  return id;
}