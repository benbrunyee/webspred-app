import React from "react";
import { BrowserRouter, HashRouter } from "react-router-dom";

const Router = ({ children }) => {
  // If dev environment
  if (process.env.ELECTRON_START_URL) {
    return <BrowserRouter>{children}</BrowserRouter>;
  } else {
    return <HashRouter>{children}</HashRouter>;
  }
};

export default Router;
