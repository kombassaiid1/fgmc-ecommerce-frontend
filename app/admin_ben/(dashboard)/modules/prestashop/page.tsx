"use client";

import { Badge, BlockStack, Text } from '@shopify/polaris';
import PrestashopConfigForm from '../prestashop-config-form';

export default function PrestashopModulePage() {
  return (
    <BlockStack gap="500">
      <div className="border-b border-[#dce4ea] pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <Text as="h1" variant="heading2xl">PrestaShop</Text>
          <Badge tone="info">Import boutique → FGMC</Badge>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#667085]">
          Connectez votre boutique PrestaShop, testez l’accès Webservice, puis importez un produit avec ses catégories, sa marque, ses attributs et ses images.
        </p>
      </div>
      <PrestashopConfigForm />
    </BlockStack>
  );
}
