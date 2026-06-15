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
  let id = sessionStorage.getItem("shopping-session-id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("shopping-session-id", id);
  }
  return id;
}