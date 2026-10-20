import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { loadTopos } from "@/bible/topos";
import App from "./App";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

loadTopos().then(
  () =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  (error: unknown) =>
    root.render(
      <div style={{ padding: 32, fontFamily: "system-ui" }}>
        <h1>Scripture Hash couldn't start</h1>
        <p>Its reference parser failed to load: {String(error)}</p>
      </div>,
    ),
);
