"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FolderX } from "lucide-react";
import { InvestmentsView } from "@/components/investments/InvestmentsView";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

// The static export can't pre-build a page per portfolio, so the id is a query
// parameter: /dashboard/investments/portfolio/?id=3
function PortfolioContent() {
  const portfolioId = Number(useSearchParams().get("id"));

  if (!Number.isInteger(portfolioId) || portfolioId <= 0) {
    return (
      <EmptyState
        icon={<FolderX />}
        title="No portfolio chosen"
        description="This link doesn't point to a portfolio. Pick one from Holdings."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/investments/">Go to Holdings</Link>
          </Button>
        }
      />
    );
  }

  return <InvestmentsView key={portfolioId} portfolioId={portfolioId} />;
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={null}>
      <PortfolioContent />
    </Suspense>
  );
}
