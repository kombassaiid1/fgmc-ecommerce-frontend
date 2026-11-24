"use client";

import Image from "next/image";
import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { useAgentTheme } from "@/components/providers/agent-theme-provider";
import styles from "./agent-themed-ui.module.css";

export function useAgentThemeStyle(): CSSProperties {
  const theme = useAgentTheme();
  return {
    "--agent-primary": theme.colors.primary,
    "--agent-secondary": theme.colors.secondary,
    "--agent-gradient": theme.gradient,
    "--agent-glow": theme.glow,
    "--agent-primary-soft": `color-mix(in srgb, ${theme.colors.primary} 10%, Canvas)`,
    "--agent-primary-softer": `color-mix(in srgb, ${theme.colors.primary} 5%, Canvas)`,
    "--agent-primary-border": `color-mix(in srgb, ${theme.colors.primary} 32%, Canvas)`,
    "--agent-focus": `color-mix(in srgb, ${theme.colors.primary} 35%, CanvasText)`,
    "--agent-surface": "Canvas",
  } as CSSProperties;
}

export function AgentAvatar({
  size = "md",
  shape = "circle",
  decorative = false,
  className = "",
}: {
  size?: "sm" | "md" | "lg" | "xl";
  shape?: "circle" | "rounded";
  decorative?: boolean;
  className?: string;
}) {
  const theme = useAgentTheme();
  const themeStyle = useAgentThemeStyle();
  const dimensions = { sm: "size-7", md: "size-10", lg: "size-12", xl: "size-16" }[size];
  const rounding = shape === "circle" ? "rounded-full" : "rounded-xl";

  return (
    <span
      className={`${styles.avatar} ${dimensions} ${rounding} ${className}`}
      style={themeStyle}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : theme.name}
      aria-hidden={decorative || undefined}
    >
      <Image
        src={theme.image}
        alt=""
        fill
        sizes="64px"
        className={styles.avatarImage}
      />
    </span>
  );
}

export function AgentBadge({ children }: { children?: ReactNode }) {
  const theme = useAgentTheme();
  const themeStyle = useAgentThemeStyle();
  return (
    <span className={styles.badge} style={themeStyle}>
      <span className={styles.badgeDot} aria-hidden="true" />
      {children ?? theme.name}
    </span>
  );
}

type AgentButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
};

export function AgentButton({
  children,
  className = "",
  disabled = false,
  loading = false,
  type = "button",
  ...props
}: AgentButtonProps) {
  const themeStyle = useAgentThemeStyle();
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${styles.button} ${className}`}
      style={themeStyle}
    >
      {loading ? <LoaderCircle size={15} className={styles.spinner} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function AgentHeader({
  titleAs = "h2",
  leading,
  children,
  className = "",
}: {
  titleAs?: "h1" | "h2";
  leading?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const theme = useAgentTheme();
  const themeStyle = useAgentThemeStyle();
  const Title = titleAs;
  return (
    <header className={`${styles.header} ${className}`} style={themeStyle}>
      {leading}
      <AgentAvatar shape="rounded" decorative />
      <div className="min-w-0 flex-1">
        <Title className={styles.headerTitle}>{theme.name}</Title>
        <p className={styles.headerStatus}>
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          En ligne
        </p>
      </div>
      {children}
    </header>
  );
}

export function AgentLoader({ label }: { label?: string }) {
  const themeStyle = useAgentThemeStyle();
  return (
    <span className={styles.loader} style={themeStyle} role={label ? "status" : undefined}>
      <LoaderCircle size={15} className={styles.spinner} aria-hidden="true" />
      {label ? <span className="text-slate-600 dark:text-slate-300">{label}</span> : null}
    </span>
  );
}
