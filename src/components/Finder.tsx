import { FinderDragHandle, FinderItem } from "./collections/FinderItem.js";
import { FinderList } from "./collections/FinderList.js";
import {
  FinderCell,
  FinderColumn,
  FinderTable,
  FinderTableBody,
  FinderTableHeader,
} from "./collections/FinderTable.js";
import { FinderTree } from "./collections/FinderTree.js";
import { FinderBreadcrumbItem, FinderBreadcrumbs } from "./FinderBreadcrumbs.js";
import { FinderButton } from "./FinderButton.js";
import { FinderContextMenu, FinderMenuItem, FinderMenuSeparator } from "./FinderContextMenu.js";
import { FinderDropZone } from "./FinderDropZone.js";
import { FinderLocationItem, FinderLocations } from "./FinderLocations.js";
import { FinderPreview } from "./FinderPreview.js";
import { FinderRenameInput } from "./FinderRenameInput.js";
import { FinderRoot } from "./FinderRoot.js";
import { FinderSearchInput } from "./FinderSearchInput.js";
import { FinderState } from "./FinderState.js";
import { FinderToolbar } from "./FinderToolbar.js";

/**
 * Root component plus namespace: `<Finder adapter={...}><Finder.List>...</Finder.List></Finder>`.
 * Every member is also exported by name (`FinderList`, ...) for tree-shaking.
 */
export const Finder: typeof FinderRoot & {
  List: typeof FinderList;
  Table: typeof FinderTable;
  TableHeader: typeof FinderTableHeader;
  TableBody: typeof FinderTableBody;
  Column: typeof FinderColumn;
  Cell: typeof FinderCell;
  Tree: typeof FinderTree;
  Item: typeof FinderItem;
  DragHandle: typeof FinderDragHandle;
  Button: typeof FinderButton;
  Toolbar: typeof FinderToolbar;
  Breadcrumbs: typeof FinderBreadcrumbs;
  Breadcrumb: typeof FinderBreadcrumbItem;
  SearchInput: typeof FinderSearchInput;
  RenameInput: typeof FinderRenameInput;
  ContextMenu: typeof FinderContextMenu;
  MenuItem: typeof FinderMenuItem;
  MenuSeparator: typeof FinderMenuSeparator;
  DropZone: typeof FinderDropZone;
  Locations: typeof FinderLocations;
  LocationItem: typeof FinderLocationItem;
  Preview: typeof FinderPreview;
  State: typeof FinderState;
} = Object.assign(FinderRoot, {
  List: FinderList,
  Table: FinderTable,
  TableHeader: FinderTableHeader,
  TableBody: FinderTableBody,
  Column: FinderColumn,
  Cell: FinderCell,
  Tree: FinderTree,
  Item: FinderItem,
  DragHandle: FinderDragHandle,
  Button: FinderButton,
  Toolbar: FinderToolbar,
  Breadcrumbs: FinderBreadcrumbs,
  Breadcrumb: FinderBreadcrumbItem,
  SearchInput: FinderSearchInput,
  RenameInput: FinderRenameInput,
  ContextMenu: FinderContextMenu,
  MenuItem: FinderMenuItem,
  MenuSeparator: FinderMenuSeparator,
  DropZone: FinderDropZone,
  Locations: FinderLocations,
  LocationItem: FinderLocationItem,
  Preview: FinderPreview,
  State: FinderState,
});
