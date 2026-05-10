import "@/assets/styles/tokens.css";
import "@/assets/styles/popup.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { installFonts } from "@/assets/install-fonts";
import { Popup } from "@/ui/popup/Popup";

installFonts();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
