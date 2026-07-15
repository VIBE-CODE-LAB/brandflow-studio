import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { StudioFlow } from "@/routes";
import "./styles.css";

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <StrictMode>
      <StudioFlow />
    </StrictMode>,
  );
}
