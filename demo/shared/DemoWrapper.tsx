import type { ReactElement, ReactNode } from "react";

interface DemoWrapperProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function DemoWrapper({ title, description, children }: DemoWrapperProps): ReactElement {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border bg-muted/30">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="flex-1 overflow-hidden p-6">{children}</div>
    </div>
  );
}
