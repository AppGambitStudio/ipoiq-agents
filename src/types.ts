export type ScannedIPO = {
  name: string;
  company_full_name: string;
  price_band: string;
  open_date: string;
  close_date: string;
  lot_size: number;
  exchange: string;
  issue_size?: string;
  ipo_type?: string;
};

export type IPOScanResult = {
  scan_date: string;
  total_open_ipos: number;
  ipos: ScannedIPO[];
};

export type AgentResult = {
  agent: string;
  ipo_name: string;
  result: string;
  error?: string;
  duration_ms?: number;
};

export type IPOResearchBundle = {
  ipo: ScannedIPO;
  growth: AgentResult;
  valuation: AgentResult;
  risk: AgentResult;
  news: AgentResult;
  sentiment: AgentResult;
};
