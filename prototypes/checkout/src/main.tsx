import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BusinessConsole } from "./BusinessConsole";
import { GuestPhone } from "./GuestPhone";
import { Scenario } from "./Scenario";
import { WaiterPhone } from "./WaiterPhone";
import { copy } from "./copy";
import { useFlow } from "./useFlow";
import "./styles.css";

function App() {
  const { state, dispatch, now } = useFlow();
  return (
    <main className="app">
      <h1 className="app-title">{copy.app.title}</h1>
      <Scenario state={state} dispatch={dispatch} />
      <div className="panels">
        <BusinessConsole state={state} dispatch={dispatch} />
        <GuestPhone state={state} dispatch={dispatch} now={now} />
        <WaiterPhone state={state} dispatch={dispatch} />
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
