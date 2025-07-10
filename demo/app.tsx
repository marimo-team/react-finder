import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { demos } from "./demos/registry.js";

function NoDemo() {
  return null;
}

function getInitialDemo(): string {
  const hash = window.location.hash.slice(1);
  if (hash && demos.some((d) => d.id === hash)) {
    return hash;
  }
  return demos[0]?.id ?? "";
}

function App() {
  const [activeId, setActiveId] = useState(getInitialDemo);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash && demos.some((d) => d.id === hash)) {
        setActiveId(hash);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  const selectDemo = (id: string) => {
    setActiveId(id);
    window.location.assign(`#${id}`);
  };

  const active = demos.find((d) => d.id === activeId) ?? demos[0];
  const ActiveComponent = active?.component ?? NoDemo;

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <nav className="w-60 flex-shrink-0 border-r border-border bg-muted/30 flex flex-col">
        <div className="p-4 border-b border-border">
          <h1 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span>React Finder</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Demo Gallery</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {demos.map((demo, i) => (
            <button
              key={demo.id}
              type="button"
              onClick={() => {
                selectDemo(demo.id);
              }}
              className={`w-full text-left px-3 py-2 rounded-md mb-0.5 transition-colors ${
                activeId === demo.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-accent/50"
              }`}
            >
              <div className="text-sm">
                <span className="text-muted-foreground mr-1.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {demo.title}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 pl-6">{demo.description}</div>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-border">
          <a
            href="https://github.com/marimo-team/react-finder"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            GitHub
          </a>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <ActiveComponent />
      </main>
    </div>
  );
}

const container = document.querySelector("#root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
