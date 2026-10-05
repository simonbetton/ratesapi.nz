import { additionalSources } from "./additional-sources";
import { amexSources } from "./amex";
import { anzSources } from "./anz";
import { cardSources } from "./card-sources";
import { cooperativeSources } from "./cooperative";
import { discoveredSources } from "./discovered-sources";
import { finalSources } from "./final-sources";
import { heartlandSources } from "./heartland";
import institutionData from "./institutions.json";
import { kiwibankSources } from "./kiwibank";
import { loanSources } from "./loan-sources";
import { majorBankSources } from "./major-bank-sources";
import { moreBankSources } from "./more-bank-sources";
import { otherMortgageSources } from "./other-mortgage-sources";
import { pdfSources } from "./pdf-sources";
import { remainingSources } from "./remaining-sources";
import { retailSources } from "./retail-sources";
import { tableSources } from "./table-sources";
import { tsbSources } from "./tsb";
import type { DirectSource, Institution } from "./types";

export const institutions: Institution[] = institutionData as Institution[];
export const directSources: DirectSource[] = [
  ...discoveredSources,
  ...finalSources,
  ...additionalSources,
  ...amexSources,
  ...retailSources,
  ...otherMortgageSources,
  ...remainingSources,
  ...moreBankSources,
  ...pdfSources,
  ...anzSources,
  ...majorBankSources,
  ...cardSources,
  ...heartlandSources,
  ...cooperativeSources,
  ...kiwibankSources,
  ...loanSources,
  ...tableSources,
  ...tsbSources,
];
