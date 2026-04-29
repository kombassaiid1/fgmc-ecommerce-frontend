"use client";

import { useMemo } from "react";
import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";

import { puckConfig } from "./puck-config";

type PuckEditorProps = {
  data: Record<string, unknown>;
  onPublish: (data: Record<string, unknown>) => Promise<void> | void;
};

export function PuckEditor({ data, onPublish }: PuckEditorProps) {
  const initialData = useMemo(() => data, [data]);

  return (
    <Puck
      config={puckConfig}
      data={initialData}
      onPublish={async (nextData) => {
        await onPublish(nextData as Record<string, unknown>);
      }}
    />
  );
}
