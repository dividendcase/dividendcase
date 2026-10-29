"use client";

import { Input } from "@/components/ui/input";
import type { Portfolio } from "@/lib/types";

/** The API's limit (api/v1/portfolios.py MAX_PORTFOLIOS) */
export const MAX_PORTFOLIOS = 4;

/** Where imported holdings go: an existing portfolio, or a new one with this name */
export type PortfolioTarget = { portfolioId: number } | { newPortfolio: string };

/**
 * The portfolio to suggest for a broker's import: one already named after the broker ("Angel" for
 * Angel One); else, for someone who keeps a portfolio per account, a new one with the broker's name;
 * else the first portfolio. With none yet, a new one named after the broker.
 */
export function suggestedTarget(portfolios: Portfolio[], broker: string): PortfolioTarget {
  const word = broker.toLowerCase().split(" ")[0];
  const named = portfolios.find((p) => p.name.toLowerCase().includes(word));
  if (named) return { portfolioId: named.id };
  if (portfolios.length === 0 || (portfolios.length >= 2 && portfolios.length < MAX_PORTFOLIOS)) {
    return { newPortfolio: broker };
  }
  return { portfolioId: portfolios[0].id };
}

export function PortfolioChoice({
  portfolios,
  broker,
  target,
  onChange,
}: {
  portfolios: Portfolio[];
  broker: string;
  target: PortfolioTarget;
  onChange: (target: PortfolioTarget) => void;
}) {
  const full = portfolios.length >= MAX_PORTFOLIOS;
  const isNew = "newPortfolio" in target;
  return (
    <div className="space-y-2">
      <label className="flex items-center justify-between gap-3 text-[13px] text-ink-2">
        Add to
        <select
          value={isNew ? "new" : String(target.portfolioId)}
          onChange={(e) =>
            onChange(e.target.value === "new" ? { newPortfolio: broker } : { portfolioId: Number(e.target.value) })
          }
          className="h-9 w-56 rounded-md border border-line bg-well px-2.5 text-[13px] text-ink"
        >
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="new" disabled={full}>
            {full ? `New portfolio (up to ${MAX_PORTFOLIOS})` : "New portfolio…"}
          </option>
        </select>
      </label>
      {isNew && (
        <label className="flex items-center justify-between gap-3 text-[13px] text-ink-2">
          Name
          <Input
            value={target.newPortfolio}
            maxLength={100}
            onChange={(e) => onChange({ newPortfolio: e.target.value })}
            aria-label="New portfolio name"
            className="h-9 w-56"
          />
        </label>
      )}
    </div>
  );
}

/** The fields the import API takes for a target */
export function targetFields(target: PortfolioTarget): { portfolio_id?: number; new_portfolio?: string } {
  return "newPortfolio" in target ? { new_portfolio: target.newPortfolio.trim() } : { portfolio_id: target.portfolioId };
}
