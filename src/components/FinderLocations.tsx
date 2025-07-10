import type { JSX, ReactElement } from "react";
import { ListBox, ListBoxItem } from "react-aria-components";
import type { ListBoxItemProps, ListBoxProps } from "react-aria-components";

import type { Location } from "../core/types.js";
import { useFinder } from "../hooks/useFinder.js";
import { useFinderStore } from "../hooks/useFinderStore.js";

export interface FinderLocationsProps extends Omit<
  ListBoxProps<Location>,
  "children" | "items" | "selectedKeys" | "onSelectionChange" | "selectionMode"
> {
  children: (location: Location) => ReactElement;
}

/** A react-aria `ListBox` of locations; selecting one switches the active location. */
export function FinderLocations({ children, ...props }: FinderLocationsProps): JSX.Element {
  const store = useFinderStore();
  const { locations, currentLocationId } = useFinder((s) => ({
    locations: s.locations,
    currentLocationId: s.currentLocationId,
  }));
  return (
    <ListBox
      aria-label="Locations"
      items={locations}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[currentLocationId]}
      onSelectionChange={(keys) => {
        if (keys === "all") return;
        const id = [...keys][0];
        if (id !== undefined && String(id) !== currentLocationId) {
          void store.getState().setLocation(String(id));
        }
      }}
      {...props}
    >
      {children}
    </ListBox>
  );
}

export interface FinderLocationItemProps extends Omit<ListBoxItemProps, "id"> {
  location: Location;
}

/** One location. Emits `data-location-id` and `data-active`. */
export function FinderLocationItem({ location, ...props }: FinderLocationItemProps): JSX.Element {
  const isActive = useFinder((s) => s.currentLocationId === location.id);
  return (
    <ListBoxItem
      id={location.id}
      textValue={location.name}
      data-location-id={location.id}
      data-active={isActive || undefined}
      {...props}
    />
  );
}
