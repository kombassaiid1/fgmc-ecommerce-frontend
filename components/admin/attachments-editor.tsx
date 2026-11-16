"use client";

import { useRef, useState } from "react";
import { Banner, BlockStack, Button, Checkbox, InlineStack, Text, TextField } from "@shopify/polaris";
import { FileText, Trash2 } from "lucide-react";
import { uploadMedia } from "@/lib/api/media";
import type { ProductAttachment } from "@/lib/api/products";

type Props = {
  value: ProductAttachment[];
  onChange: (next: ProductAttachment[]) => void;
};

function formatSize(bytes?: number) {
  if (!bytes) return "";
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} Mo`
    : `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

export function AttachmentsEditor({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (index: number, patch: Partial<ProductAttachment>) =>
    onChange(value.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    const added: ProductAttachment[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(files)) {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        rejected.push(`${file.name} (PDF uniquement)`);
        continue;
      }
      try {
        const media = await uploadMedia({ file }, { fileSize: file.size });
        added.push({
          name: file.name.replace(/\.pdf$/i, ""),
          url: media.url,
          size: file.size,
          isPublic: true,
        });
      } catch (uploadError) {
        rejected.push(
          `${file.name} (${uploadError instanceof Error ? uploadError.message : "échec"})`,
        );
      }
    }
    if (added.length) onChange([...value, ...added]);
    if (rejected.length) setError(`Fichiers non ajoutés : ${rejected.join(", ")}`);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <BlockStack gap="300">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(event) => void handleFiles(event.target.files)}
      />
      <InlineStack>
        <Button loading={uploading} onClick={() => inputRef.current?.click()}>
          Ajouter des PDF
        </Button>
      </InlineStack>
      {error ? <Banner tone="critical" title={error} onDismiss={() => setError(null)} /> : null}
      {value.length === 0 ? (
        <Text as="p" variant="bodySm" tone="subdued">Aucune pièce jointe.</Text>
      ) : (
        <div className="space-y-2">
          {value.map((item, index) => (
            <div
              key={`${item.url}-${index}`}
              className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
              <FileText className="size-5 shrink-0 text-slate-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <BlockStack gap="150">
                  <TextField
                    label="Nom de l'onglet"
                    value={item.name}
                    autoComplete="off"
                    onChange={(name) => update(index, { name })}
                  />
                  <Checkbox
                    label="Public (visible par tous les visiteurs)"
                    helpText={
                      item.isPublic === false
                        ? "Téléchargeable uniquement par le client après la livraison de sa commande."
                        : "Décochez pour réserver ce PDF aux clients dont la commande est livrée."
                    }
                    checked={item.isPublic !== false}
                    onChange={(checked) => update(index, { isPublic: checked })}
                  />
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-700 underline">
                    Ouvrir le PDF {formatSize(item.size)}
                  </a>
                </BlockStack>
              </div>
              <button
                type="button"
                aria-label={`Supprimer ${item.name}`}
                className="cursor-pointer rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600"
                onClick={() => onChange(value.filter((_, i) => i !== index))}>
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </BlockStack>
  );
}
