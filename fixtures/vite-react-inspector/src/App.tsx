import { useEffect, useState } from "react";
import { Card } from "./components/Card";
import { Navbar } from "./components/Navbar";
import "./styles/app.css";

export function App() {
  const [route, setRoute] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <main className="app-main">
      <Navbar />
      {route === "/details" ? (
        <p className="spa-details">Details route</p>
      ) : (
        <Card title="Inspector fixture">
          <p>Nested text inside a card, rendered from another file.</p>
          <a
            className="spa-link"
            href="/details"
            onClick={(e) => {
              e.preventDefault();
              history.pushState({}, "", "/details");
              setRoute("/details");
            }}
          >
            Details
          </a>
        </Card>
      )}
    </main>
  );
}
