"use client";

import { Badge, Text } from "@shopify/polaris";
import StripeConfigForm from "./stripe-config-form";

export default function StripeModulePage() {
  return (
    <div className="stripe-module">
      <header className="stripe-module-head">
        <div className="stripe-module-title">
          <Text as="h1" variant="heading2xl">Stripe</Text>
          <Badge tone="info">Paiement par carte</Badge>
        </div>
        <p>Connectez votre compte Stripe pour accepter les paiements en ligne, d’abord en sandbox pour tester, puis en live pour encaisser.</p>
      </header>
      <StripeConfigForm />
    </div>
  );
}
