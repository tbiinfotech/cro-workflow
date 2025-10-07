export interface SplitVariation {
  name: string;
  changes: {
    type: "defaultRedirect";
    data: {
      original_pattern: string;
      variation_pattern: string;
      // case_sensitive?: boolean; // optional if you may enable it later
    };
  }[];
};

export interface ConvertSettings {
  convert_api_key: string | null;
  convert_secret_key: string | null;
  convert_project_id: string | null;
  convert_account_id: string | null;
};
