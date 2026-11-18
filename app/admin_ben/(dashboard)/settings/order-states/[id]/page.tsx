"use client";

import { use } from "react";
import { OrderStateForm } from "../order-state-form";

export default function EditOrderStatePage({ params }: { params: Promise<{ id: string }> }) {
  return <OrderStateForm id={use(params).id} />;
}
