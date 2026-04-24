import "./index.css";
import { Dashboard } from "./pages/Dashboard";
import { PasswordGate } from "./components/PasswordGate";

export default function App() {
  return (
    <PasswordGate>
      <Dashboard />
    </PasswordGate>
  );
}
