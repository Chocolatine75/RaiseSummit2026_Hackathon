import React from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import App from "./App.jsx";

// The service worker is served by the Keeper in production; skip it in dev
// (Vite has no /sw.js, so registering it just throws a MIME error).
if (import.meta.env.PROD && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
createRoot(document.getElementById("root")).render(<App />);
