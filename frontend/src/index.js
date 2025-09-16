import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { ToastProvider } from "./components/ui/ToastProvider";
import App from "./App";
import store from "./store/store"; // Adjust the path if necessary
import "./styles.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ToastProvider>
      <Provider store={store}>
        <App />
      </Provider>
    </ToastProvider>
  </React.StrictMode>
);
