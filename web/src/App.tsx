import { useOntologyStore } from "./store";
import { StartScreen } from "./components/StartScreen";
import { EditorScreen } from "./components/EditorScreen";

export default function App() {
  const screen = useOntologyStore((s) => s.screen);
  const doc = useOntologyStore((s) => s.doc);

  if (screen === "start" || !doc) {
    return <StartScreen />;
  }

  return <EditorScreen doc={doc} />;
}
