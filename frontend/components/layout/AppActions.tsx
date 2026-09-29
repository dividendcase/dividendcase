"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { ImportExcelDialog } from "@/components/investments/ImportExcelDialog";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { useExcelIO } from "@/lib/hooks/useExcelIO";
import { TooltipProvider } from "@/components/ui/tooltip";

interface AppActions {
  openImport: () => void;
  openCommand: () => void;
  exportExcel: () => Promise<void>;
  downloadReport: (portfolioId?: number) => Promise<void>;
}

const AppActionsContext = createContext<AppActions | null>(null);

/** Actions any page can start: the Excel import dialog, the ⌘K palette, exports. */
export function AppActionsProvider({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig();
  const excel = useExcelIO();
  const [importOpen, setImportOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  const openImport = useCallback(() => {
    setCommandOpen(false);
    setImportOpen(true);
  }, []);
  const openCommand = useCallback(() => setCommandOpen(true), []);

  const value = useMemo<AppActions>(
    () => ({
      openImport,
      openCommand,
      exportExcel: excel.exportPortfolios,
      downloadReport: excel.downloadReport,
    }),
    // excel's functions are recreated each render but only wrap stable API calls
    [openImport, openCommand]
  );

  return (
    <AppActionsContext.Provider value={value}>
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onImport={openImport}
        onExport={excel.exportPortfolios}
        onReport={() => excel.downloadReport()}
      />
      <ImportExcelDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={excel.importPortfolios}
        onDownloadTemplate={excel.downloadTemplate}
        // An import can touch portfolios, holdings, watchlists and the data queue: refetch everything
        onComplete={() => mutate(() => true)}
      />
    </AppActionsContext.Provider>
  );
}

export function useAppActions(): AppActions {
  const ctx = useContext(AppActionsContext);
  if (!ctx) throw new Error("useAppActions must be used inside AppActionsProvider");
  return ctx;
}
