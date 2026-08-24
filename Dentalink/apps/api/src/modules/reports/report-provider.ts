import { ExcelReportDefinition } from "./dto/reports.dto";

export type ReportRow = Record<string, string | number | boolean | Date | null>;

export type ReportProviderContext = {
  organizationId: string;
  requestedById: string;
  branchIds: string[];
  parameters: Record<string, unknown>;
};

export type ReportProviderResult = {
  definition: ExcelReportDefinition;
  rows: AsyncIterable<ReportRow>;
};

export interface ReportProvider {
  supports(code: string): boolean;
  generate(context: ReportProviderContext): Promise<ReportProviderResult>;
}
