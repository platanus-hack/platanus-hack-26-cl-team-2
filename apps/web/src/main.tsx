import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MeshApp as App } from "./mesh/MeshApp";
import "./styles.css";
import "./mesh/mesh.css";
import "./brutal.css";

/**
 * Team members open the app once with ?admin=<token>: it is saved to localStorage (read by
 * writeHeaders in api.ts) and stripped from the URL so it does not linger in history.
 * ?admin= with an empty value forgets the token.
 */
function captureAdminToken(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("admin")) return;
    const token = url.searchParams.get("admin")?.trim();
    if (token) localStorage.setItem("meshAdminToken", token);
    else localStorage.removeItem("meshAdminToken");
    url.searchParams.delete("admin");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  } catch {
    // storage blocked: writes stay unauthenticated
  }
}
captureAdminToken();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
