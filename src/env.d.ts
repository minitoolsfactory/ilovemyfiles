/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Country policy resolved from the hosting provider's trusted geo data. */
    geo: {
      feature: string;
      country: string | null;
      countrySource: string;
      region: 'india' | 'outside' | 'unknown' | 'crawler';
      reason: string;
      showTool: boolean;
      showEntryPoint: boolean;
      indexable: boolean;
      message: string;
      detectedAt: string;
    };
  }
}
