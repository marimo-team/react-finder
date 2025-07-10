import type { JSX, ReactElement } from "react";
import { Breadcrumb, Breadcrumbs } from "react-aria-components";
import type { BreadcrumbProps, BreadcrumbsProps } from "react-aria-components";

import { selectBreadcrumbs } from "../core/selectors.js";
import type { Breadcrumb as Crumb } from "../core/selectors.js";
import { useFinder } from "../hooks/useFinder.js";
import { useFinderStore } from "../hooks/useFinderStore.js";

export type FinderBreadcrumb = Crumb;

export interface FinderBreadcrumbsProps extends Omit<
  BreadcrumbsProps<Crumb>,
  "children" | "items" | "onAction"
> {
  /** Path to render; defaults to the current path. */
  path?: string;
  children: (crumb: Crumb) => ReactElement;
}

/** react-aria `Breadcrumbs` for the current path. Pressing a crumb navigates. */
export function FinderBreadcrumbs({
  path,
  children,
  ...props
}: FinderBreadcrumbsProps): JSX.Element {
  const store = useFinderStore();
  const crumbs = useFinder((s) => selectBreadcrumbs(s, path));
  return (
    <Breadcrumbs
      items={crumbs}
      onAction={(key) => void store.getState().navigate(String(key))}
      {...props}
    >
      {children}
    </Breadcrumbs>
  );
}

export interface FinderBreadcrumbItemProps extends Omit<BreadcrumbProps, "id"> {
  crumb: Crumb;
}

/** One crumb; render a react-aria `<Link>` inside it. Emits `data-root` and `data-path`. */
export function FinderBreadcrumbItem({ crumb, ...props }: FinderBreadcrumbItemProps): JSX.Element {
  return (
    <Breadcrumb
      id={crumb.path}
      data-root={crumb.isRoot || undefined}
      data-path={crumb.path}
      {...props}
    />
  );
}
