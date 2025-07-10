import { Finder } from "@marimo-team/react-finder";
import type { ReactElement } from "react";
import { Link } from "react-aria-components";

/** Styled breadcrumbs shared by the demos. Pressing a crumb navigates. */
export function Breadcrumbs(): ReactElement {
  return (
    <Finder.Breadcrumbs className="flex items-center gap-1 text-sm px-1">
      {(crumb) => (
        <Finder.Breadcrumb
          crumb={crumb}
          className="flex items-center gap-1 data-[current]:font-semibold"
        >
          <Link className="px-1 rounded outline-none cursor-pointer text-foreground data-[hovered]:underline data-[current]:cursor-default data-[current]:no-underline data-[focus-visible]:ring-2 data-[focus-visible]:ring-primary/40">
            {crumb.isRoot ? "Home" : crumb.name}
          </Link>
          {!crumb.isCurrent && <span className="text-muted-foreground">/</span>}
        </Finder.Breadcrumb>
      )}
    </Finder.Breadcrumbs>
  );
}
