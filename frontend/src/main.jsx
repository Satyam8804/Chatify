import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./context/authContext";
import { SocketProvider } from "./context/socketContext";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import { ThemeProvider } from "./context/themeContext";
import AppWrapper from "./AppWrapper";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <AppWrapper>
            <App />
          </AppWrapper>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);