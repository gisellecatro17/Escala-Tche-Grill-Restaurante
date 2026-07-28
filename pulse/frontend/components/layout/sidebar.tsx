"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";

import { MENU } from "@/lib/menu";
import { useSession } from "@/lib/auth/session-context";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { hasPermission, currentMembership } = useSession();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <Activity className="size-6 text-sidebar-primary" />
        <div className="flex flex-col leading-none">
          <span className="text-base font-semibold">Pulse</span>
          <span className="text-[11px] text-sidebar-foreground/60">Gestão financeira</span>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {MENU.map((mod) => {
          const visibleItems = mod.items.filter(
            (item) => !item.permission || !currentMembership || hasPermission(item.permission),
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={mod.label}>
              <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wide text-sidebar-foreground/50 uppercase">
                {mod.label}
              </p>
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;

                  if (!item.implemented) {
                    return (
                      <li key={item.href}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground/40"
                              aria-disabled
                            >
                              <Icon className="size-4 shrink-0" />
                              <span className="flex-1 truncate">{item.label}</span>
                              <Badge variant="outline" className="border-sidebar-border text-[10px] text-sidebar-foreground/50">
                                Em breve
                              </Badge>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right">Módulo ainda não disponível</TooltipContent>
                        </Tooltip>
                      </li>
                    );
                  }

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3 text-[11px] text-sidebar-foreground/40">
        Pulse © {new Date().getFullYear()}
      </div>
    </div>
  );
}
