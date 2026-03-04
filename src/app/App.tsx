import React from "react";
import { WorkspaceProvider, useWorkspace } from "./store";
import { ConnectProject } from "./components/connect-project";
import WorkspacePage from "./pages/workspace";
import { DesignDead } from "./components/designdead-engine";

function AppRouter() {
  const { state } = useWorkspace();

  if (state.currentView === "onboarding" || !state.project) {
    return <ConnectProject />;
  }

  return <WorkspacePage />;
}

export default function App() {
  return (
    <WorkspaceProvider>
      <AppRouter />
      {/* 
        The DesignDead Engine — this is what gets published to npm.
        It works as a floating overlay inspecting the current page.
        Users install: npm install designdead -D
        Then: import { DesignDead } from 'designdead'; <DesignDead />
      */}
      <DesignDead position="bottom-right" theme="dark" devOnly={false} />
    </WorkspaceProvider>
  );
}
