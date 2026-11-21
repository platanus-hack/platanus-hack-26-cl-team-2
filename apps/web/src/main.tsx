import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MeshApp as App } from "./mesh/MeshApp";
import "./styles.css";
import "./mesh/mesh.css";
import "./brutal.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
