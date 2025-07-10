import {
  createSessionStorageAdapter,
  FileSystemAccessAdapter,
  Finder,
  MemoryAdapter,
  VirtualFS,
} from "@marimo-team/react-finder";
import type { Location } from "@marimo-team/react-finder";
import { useState } from "react";
import type { ReactElement } from "react";
import { Button } from "react-aria-components";

import { Breadcrumbs } from "../shared/Breadcrumbs.js";
import { DemoWrapper } from "../shared/DemoWrapper.js";
import { Icon } from "../shared/Icon.js";
import { demoSeed } from "../shared/seed.js";
import { button, emptyState, locationItem, panel, row, toolbar } from "../shared/styles.js";

// Two adapters sharing one VirtualFS stay in sync through `watch`.
const sharedFs = new VirtualFS({ seed: demoSeed });

const baseLocations: Location[] = [
  {
    id: "home",
    name: "Home",
    description: "In-memory",
    icon: "🏠",
    adapter: new MemoryAdapter({ fs: sharedFs }),
  },
  {
    id: "projects",
    name: "Projects",
    description: "Same memory, different root",
    icon: "🛠️",
    rootPath: "/Projects",
    adapter: new MemoryAdapter({ fs: sharedFs }),
  },
  {
    id: "session",
    name: "Session",
    description: "Persists in sessionStorage",
    icon: "💾",
    adapter: createSessionStorageAdapter({
      key: "react-finder-demo",
      seed: { "Reload me.txt": "I survive a page reload." },
    }),
  },
];

export default function MultiLocationDemo(): ReactElement {
  const [locations, setLocations] = useState(baseLocations);

  const openLocalFolder = async () => {
    const picker = (
      window as unknown as {
        showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker;
    if (!picker) return;
    try {
      const root = await picker();
      setLocations((prev) => [
        ...prev.filter((l) => l.id !== "local"),
        {
          id: "local",
          name: root.name,
          description: "File System Access API",
          icon: "🖥️",
          adapter: new FileSystemAccessAdapter({ root }),
        },
      ]);
    } catch {
      // User cancelled the picker.
    }
  };

  return (
    <DemoWrapper
      title="Multiple locations"
      description="Finder.Locations is a react-aria ListBox over the location list. Each location has its own adapter, cache and history. Changing the `locations` prop after mount is supported."
    >
      <Finder locations={locations} className="grid grid-cols-[220px_1fr] gap-3 h-full">
        <div className="flex flex-col gap-2 min-h-0">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
            Locations
          </div>
          <Finder.Locations className="outline-none flex flex-col gap-1">
            {(location) => (
              <Finder.LocationItem location={location} className={locationItem}>
                <div className="font-medium text-sm">
                  {location.icon} {location.name}
                </div>
                {location.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">{location.description}</div>
                )}
              </Finder.LocationItem>
            )}
          </Finder.Locations>
          {FileSystemAccessAdapter.isSupported() && (
            <Button
              className={`${button} mt-auto`}
              onPress={() => {
                void openLocalFolder();
              }}
            >
              Open local folder…
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-3 min-w-0">
          <Finder.Toolbar className={toolbar}>
            <Finder.Button action="back" className={button}>
              ← Back
            </Finder.Button>
            <Finder.Button action="forward" className={button}>
              Forward →
            </Finder.Button>
            <Finder.Button action="up" className={button}>
              ↑ Up
            </Finder.Button>
            <Finder.Button action="newFolder" className={button}>
              New folder
            </Finder.Button>
            <Finder.Button action="delete" className={`${button} text-destructive`}>
              Delete
            </Finder.Button>
          </Finder.Toolbar>
          <Breadcrumbs />
          <div className={panel}>
            <Finder.List
              className="outline-none"
              renderEmptyState={({ isLoading, error }) => {
                let label = "Empty folder";
                if (isLoading) label = "Loading…";
                else if (error) label = `${error.code}: ${error.message}`;
                return <div className={emptyState}>{label}</div>;
              }}
            >
              {(item) => (
                <Finder.Item item={item} className={row}>
                  <Icon item={item} />
                  <span className="text-sm">{item.name}</span>
                </Finder.Item>
              )}
            </Finder.List>
          </div>
        </div>
      </Finder>
    </DemoWrapper>
  );
}
