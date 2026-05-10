import "@/assets/styles/tokens.css";
import "@/assets/styles/options.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { installFonts } from "@/assets/install-fonts";
import { Options } from "@/ui/options/Options";

installFonts();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
);
