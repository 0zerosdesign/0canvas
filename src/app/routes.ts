import { createBrowserRouter } from "react-router";
import DocsPage from "./pages/docs";
import WorkspacePage from "./pages/workspace";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: DocsPage,
  },
  {
    path: "/workspace",
    Component: WorkspacePage,
  },
]);
