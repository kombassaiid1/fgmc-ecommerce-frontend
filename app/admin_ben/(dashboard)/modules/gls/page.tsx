"use client";

import { Badge, Text } from "@shopify/polaris";
import GlsConfigForm from "./gls-config-form";

export default function GlsModulePage() {
  return (
    <div className="gls-module">
      <header className="gls-module-head">
        <div className="gls-module-title">
          <Text as="h1" variant="heading2xl">GLS France</Text>
          <Badge tone="info">Expédition et suivi de colis</Badge>
        </div>
        <p>Créez les étiquettes GLS depuis chaque commande et suivez les colis. Utilisez les mêmes identifiants que dans l’onglet « Compte GLS » de votre module PrestaShop.</p>
      </header>
      <GlsConfigForm />
    </div>
  );
}
