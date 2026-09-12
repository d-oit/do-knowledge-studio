"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

/** Toggle switch for boolean on/off state. */
const Switch = ({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) => {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer group inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "dark:group-data-[state=unchecked]:bg-input/80 relative inline-flex h-[1.15rem] w-8 items-center rounded-full border border-transparent bg-input shadow-xs transition-all group-data-[state=checked]:bg-primary"
        )}
      >
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          className={cn(
            "bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform group-data-[state=checked]:translate-x-[calc(100%-2px)] group-data-[state=unchecked]:translate-x-0"
          )}
        />
      </span>
    </SwitchPrimitive.Root>
  )
}

export { Switch }
