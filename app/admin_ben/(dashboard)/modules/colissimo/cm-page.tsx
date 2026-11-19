"use client";

import type { ReactNode } from "react";
import { ColissimoFrame, type PageId } from "./cm-shell";
import { ConfigProvider, useColissimo } from "./cm-kit";

function Inner({ current, title, children }: { current: PageId; title: string; children: ReactNode }) {
  const { config } = useColissimo();
  return (
    <ColissimoFrame current={current} title={title} colishipEnabled={config.values.COLISSIMO_GENERATE_LABEL_PRESTASHOP === false}>
      {children}
    </ColissimoFrame>
  );
}

/** A Colissimo screen: loads the configuration, then shows the frame (header, navigation) around the content. */
export function ColissimoPage({ current, title, children }: { current: PageId; title: string; children: ReactNode }) {
  return (
    <ConfigProvider>
      <Inner current={current} title={title}>{children}</Inner>
    </ConfigProvider>
  );
}
