export type {
  AreaId,
  Seniority,
  Motivation,
  Proactivity,
  AgentKnobs,
  AreaPrototype,
  OrgHints,
  AgentProfile,
  ComposeProfileInput,
  RefineProfileInput,
  AreaHeadcount,
  SeniorityMix,
  OrgSizePreset,
  ComposeEnterpriseInput,
} from "./types.js";

export {
  AREA_PROTOTYPES,
  AREA_LIST,
  AREA_IDS,
  getArea,
  gtmArea,
  csmArea,
  csArea,
  engineeringArea,
  productDesignArea,
  dataArea,
  itArea,
} from "./areas/index.js";

export { composeProfile, listAreas } from "./compose.js";
export {
  profileToAgentSpecInput,
  profileToSystemPrompt,
  profileToAgentSpec,
} from "./project.js";

export {
  ENTERPRISE_PRESETS,
  DEFAULT_SENIORITY_MIX,
  allocateSeniorities,
  normalizeCounts,
  totalAgents,
  resolveSeniorityMix,
  composeEnterprise,
  emptyCounts,
  onesAcrossAreas,
} from "./enterprise.js";
