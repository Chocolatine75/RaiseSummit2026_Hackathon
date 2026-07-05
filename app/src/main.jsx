import React from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import App from "./App.jsx";

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
createRoot(document.getElementById("root")).render(<App />);
