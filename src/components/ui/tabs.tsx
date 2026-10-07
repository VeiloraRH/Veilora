import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

interface SimpleTabsProps<T extends string = string> {
  value: T;
  onChange: (val: T) => void;
  items: Array<{ id: T; label: React.ReactNode }>;
  className?: string;
}

type TabsProps =
  | (React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> & { items?: never })
  | (SimpleTabsProps<any> & { onValueChange?: never });

const Tabs = React.forwardRef<HTMLDivElement, any>(
  ({ items, onChange, value, className, children, ...props }, ref) => {
    if (items && onChange) {
      return (
        <div
          ref={ref}
          className={cn(
            "inline-flex max-w-full overflow-x-auto rounded-xl border border-border bg-muted p-1",
            className
          )}
        >
          {items.map((i: any) => (
            <button
              key={i.id}
              type="button"
              onClick={() => onChange(i.id)}
              className={cn(
                "whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                value === i.id
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {i.label}
            </button>
          ))}
        </div>
      );
    }
    return (
      <TabsPrimitive.Root
        ref={ref}
        value={value}
        onValueChange={onChange}
        className={className}
        {...props}
      >
        {children}
      </TabsPrimitive.Root>
    );
  }
);
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent, type TabsProps }
