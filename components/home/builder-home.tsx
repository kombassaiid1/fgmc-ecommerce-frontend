"use client";

import { Render, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";

import { puckConfig } from "@/app/admin_ben/page-builder/puck-config";

/** The home page as saved in the page builder. */
export function BuilderHome({ data }: { data: Data }) {
  return <Render config={puckConfig} data={data} />;
}
