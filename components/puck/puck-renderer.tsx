"use client";

import { Render } from "@measured/puck";
import "@measured/puck/puck.css";

import { puckConfig } from "./puck-config";

type PuckRendererProps = {
  data: Record<string, unknown>;
};

export function PuckRenderer({ data }: PuckRendererProps) {
  return <Render config={puckConfig} data={data} />;
}
