import { createBrowserRouter } from "react-router";
import DocsPage from "./pages/docs";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: DocsPage,
  },
]);
