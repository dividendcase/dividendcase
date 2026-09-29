import { downloadTemplate, exportPortfolios, importPortfolios, downloadReport } from "@/lib/api/backend";
import type { ImportSummary } from "@/lib/types";


export function useExcelIO() {
  const handleDownloadTemplate = async () => {
    await downloadTemplate();
  };

  const handleExport = async () => {
    await exportPortfolios();
  };

  const handleImport = async (file: File): Promise<ImportSummary> => {
    return importPortfolios(file);
  };

  const handleDownloadReport = async (portfolioId?: number) => {
    await downloadReport(portfolioId);
  };

  return { downloadTemplate: handleDownloadTemplate, exportPortfolios: handleExport, importPortfolios: handleImport, downloadReport: handleDownloadReport };
}
