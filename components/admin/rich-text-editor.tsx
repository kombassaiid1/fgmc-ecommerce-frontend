"use client";

import { useEffect, useRef, useState } from "react";
import { BlockStack, Text } from "@shopify/polaris";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { MediaPickerDialog, type MediaItem } from "./media-picker-dialog";

type RichTextEditorProps = {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  minHeight?: number;
};

const toolbarOptions = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ color: [] }, { background: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link", "image", "blockquote", "code-block"],
  ["clean"],
];

function toAbsoluteMediaUrl(url: string): string {
  const value = url.trim();
  if (!value) return value;
  if (/^https?:\/\//i.test(value) || /^data:/i.test(value)) {
    return value;
  }

  if (typeof window !== "undefined") {
    try {
      return new URL(value, window.location.origin).toString();
    } catch {
      return value;
    }
  }

  return value;
}

export function RichTextEditor({
  label,
  value,
  onChange,
  placeholder,
  minHeight = 140,
}: RichTextEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<Quill | null>(null);
  const onChangeRef = useRef(onChange);
  const lastEmittedHtmlRef = useRef("");
  const isApplyingExternalValueRef = useRef(false);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [pendingSelectionRange, setPendingSelectionRange] = useState<{
    index: number;
    length: number;
  } | null>(null);
  const selectedImageRef = useRef<HTMLImageElement | null>(null);
  const cleanupImageResizerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const normalizeHtml = (html: string) => {
    const trimmed = html.trim();
    if (!trimmed || trimmed === "<p><br></p>") {
      return "";
    }
    return trimmed;
  };

  useEffect(() => {
    if (!hostRef.current || quillRef.current) {
      return;
    }

    const container = document.createElement("div");
    hostRef.current.appendChild(container);

    const quill = new Quill(container, {
      theme: "snow",
      modules: {
        toolbar: {
          container: toolbarOptions,
        },
      },
      placeholder,
    });

    quillRef.current = quill;
    container.style.position = "relative";

    const openMediaPicker = () => {
      const range = quill.getSelection(true);
      setPendingSelectionRange(
        range
          ? { index: range.index, length: range.length }
          : { index: quill.getLength(), length: 0 }
      );
      setIsMediaPickerOpen(true);
    };

    const toolbar = quill.getModule("toolbar");
    if (toolbar?.addHandler) {
      toolbar.addHandler("image", openMediaPicker);
    }

    if (value) {
      quill.clipboard.dangerouslyPasteHTML(value);
      lastEmittedHtmlRef.current = normalizeHtml(quill.root.innerHTML);
    }

    quill.on("text-change", () => {
      if (isApplyingExternalValueRef.current) {
        return;
      }
      const html = normalizeHtml(quill.root.innerHTML);
      lastEmittedHtmlRef.current = html;
      onChangeRef.current(html);
    });

    const hideResizer = () => {
      const wrapper = container.querySelector<HTMLElement>(".ql-image-resize-box");
      if (wrapper) wrapper.style.display = "none";
      selectedImageRef.current = null;
    };

    const ensureResizer = () => {
      let wrapper = container.querySelector<HTMLElement>(".ql-image-resize-box");
      if (wrapper) return wrapper;

      wrapper = document.createElement("div");
      wrapper.className = "ql-image-resize-box";
      Object.assign(wrapper.style, {
        position: "absolute",
        border: "1px solid #111",
        boxSizing: "border-box",
        display: "none",
        pointerEvents: "none",
        zIndex: "20",
      } as CSSStyleDeclaration);

      const points = [
        { x: "-4px", y: "-4px", cursor: "nwse-resize", handle: "nw" },
        { x: "calc(100% - 4px)", y: "-4px", cursor: "nesw-resize", handle: "ne" },
        { x: "-4px", y: "calc(100% - 4px)", cursor: "nesw-resize", handle: "sw" },
        {
          x: "calc(100% - 4px)",
          y: "calc(100% - 4px)",
          cursor: "nwse-resize",
          handle: "se",
        },
      ];

      for (const point of points) {
        const h = document.createElement("span");
        h.dataset.handle = point.handle;
        Object.assign(h.style, {
          position: "absolute",
          width: "8px",
          height: "8px",
          border: "1px solid #111",
          background: "#fff",
          left: point.x,
          top: point.y,
          pointerEvents: "auto",
          cursor: point.cursor,
          boxSizing: "border-box",
        } as CSSStyleDeclaration);
        wrapper.appendChild(h);
      }

      container.appendChild(wrapper);
      return wrapper;
    };

    const positionResizer = (img: HTMLImageElement) => {
      const wrapper = ensureResizer();
      const containerRect = container.getBoundingClientRect();
      const rect = img.getBoundingClientRect();
      wrapper.style.display = "block";
      wrapper.style.left = `${String(rect.left - containerRect.left)}px`;
      wrapper.style.top = `${String(rect.top - containerRect.top)}px`;
      wrapper.style.width = `${String(rect.width)}px`;
      wrapper.style.height = `${String(rect.height)}px`;
    };

    const onImageClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.tagName !== "IMG") return;
      const img = target as HTMLImageElement;
      selectedImageRef.current = img;
      positionResizer(img);
    };

    const onRootClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.tagName !== "IMG") {
        hideResizer();
      }
    };

    const onScrollOrResize = () => {
      if (selectedImageRef.current) {
        positionResizer(selectedImageRef.current);
      }
    };

    const startResize = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const selected = selectedImageRef.current;
      if (!target || !selected || !target.dataset.handle) return;
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = selected.getBoundingClientRect().width;
      const startHeight = selected.getBoundingClientRect().height;
      const ratio = startWidth / Math.max(1, startHeight);
      const handle = target.dataset.handle;

      const onMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        const dominant = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        const sign = handle === "nw" || handle === "sw" ? -1 : 1;
        const nextWidth = Math.max(40, Math.round(startWidth + dominant * sign));
        const nextHeight = Math.max(40, Math.round(nextWidth / ratio));
        selected.style.width = `${String(nextWidth)}px`;
        selected.style.height = `${String(nextHeight)}px`;
        positionResizer(selected);
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        if (selectedImageRef.current) {
          const html = normalizeHtml(quill.root.innerHTML);
          lastEmittedHtmlRef.current = html;
          onChangeRef.current(html);
        }
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };

    quill.root.addEventListener("click", onImageClick);
    quill.root.addEventListener("click", onRootClick);
    container.addEventListener("mousedown", startResize);
    quill.root.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    cleanupImageResizerRef.current = () => {
      quill.root.removeEventListener("click", onImageClick);
      quill.root.removeEventListener("click", onRootClick);
      container.removeEventListener("mousedown", startResize);
      quill.root.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };

    return () => {
      cleanupImageResizerRef.current?.();
      cleanupImageResizerRef.current = null;
      quillRef.current = null;
      if (hostRef.current) {
        hostRef.current.innerHTML = "";
      }
    };
  }, [placeholder]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) {
      return;
    }

    const current = normalizeHtml(quill.root.innerHTML);
    const next = normalizeHtml(value || "");
    if (current === next || lastEmittedHtmlRef.current === next) {
      return;
    }

    isApplyingExternalValueRef.current = true;
    const selection = quill.getSelection();
    if (!next) {
      quill.setText("");
    } else {
      quill.clipboard.dangerouslyPasteHTML(next);
    }
    if (selection) {
      quill.setSelection(selection.index, selection.length, "silent");
    }
    isApplyingExternalValueRef.current = false;
  }, [value]);

  return (
    <BlockStack gap="150">
      <Text as="span" variant="bodyMd" fontWeight="medium">
        {label}
      </Text>
      <div style={{ minHeight: `${String(minHeight)}px` }}>
        <div ref={hostRef} />
      </div>
      <MediaPickerDialog
        open={isMediaPickerOpen}
        onClose={() => {
          setIsMediaPickerOpen(false);
          setPendingSelectionRange(null);
        }}
        onSelect={(item: MediaItem) => {
          const quill = quillRef.current;
          if (!quill) {
            setIsMediaPickerOpen(false);
            setPendingSelectionRange(null);
            return;
          }

          const range =
            pendingSelectionRange ??
            quill.getSelection(true) ?? { index: quill.getLength(), length: 0 };

          const imageUrl = toAbsoluteMediaUrl(item.url);
          try {
            quill.insertEmbed(range.index, "image", imageUrl, "user");
            quill.insertText(range.index + 1, "\n", "silent");
            quill.setSelection(range.index + 2, 0, "silent");
          } catch {
            quill.clipboard.dangerouslyPasteHTML(
              range.index,
              `<p><img src="${imageUrl}" alt="" /></p><p><br/></p>`,
              "user"
            );
            quill.setSelection(range.index + 2, 0, "silent");
          }
          const html = normalizeHtml(quill.root.innerHTML);
          lastEmittedHtmlRef.current = html;
          onChangeRef.current(html);

          setIsMediaPickerOpen(false);
          setPendingSelectionRange(null);
        }}
      />
    </BlockStack>
  );
}
