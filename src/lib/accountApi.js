import { auth } from "./firebase";
export async function accountApi(path, body, method) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Entre novamente para continuar.");
  const response = await fetch(path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Serviço indisponível. Tente novamente.");
  }
  if (!response.ok)
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Não foi possível concluir.",
    );
  return data;
}
