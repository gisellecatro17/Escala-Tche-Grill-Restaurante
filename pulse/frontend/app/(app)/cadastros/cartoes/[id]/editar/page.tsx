"use client";

import { useParams } from "next/navigation";

import { useCorporateCard } from "@/lib/api/treasury";
import { CorporateCardForm } from "@/components/treasury/corporate-card-form";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditarCartaoPage() {
  const { id } = useParams<{ id: string }>();
  const { data: card, isLoading } = useCorporateCard(id);

  if (isLoading || !card) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return <CorporateCardForm card={card} />;
}
