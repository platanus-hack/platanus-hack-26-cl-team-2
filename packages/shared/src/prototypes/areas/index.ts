import type { AreaId, AreaPrototype } from "../types.js";
import { csArea } from "./cs.js";
import { csmArea } from "./csm.js";
import { dataArea } from "./data.js";
import { engineeringArea } from "./engineering.js";
import { financeArea } from "./finance.js";
import { gtmArea } from "./gtm.js";
import { itArea } from "./it.js";
import { productDesignArea } from "./product_design.js";

export const AREA_PROTOTYPES: Record<AreaId, AreaPrototype> = {
  gtm: gtmArea,
  csm: csmArea,
  cs: csArea,
  engineering: engineeringArea,
  product_design: productDesignArea,
  data: dataArea,
  it: itArea,
  finance: financeArea,
};

export const AREA_LIST: AreaPrototype[] = [
  gtmArea,
  csmArea,
  csArea,
  engineeringArea,
  productDesignArea,
  dataArea,
  itArea,
  financeArea,
];

export const AREA_IDS = AREA_LIST.map((a) => a.id);

export function getArea(areaId: AreaId): AreaPrototype {
  const area = AREA_PROTOTYPES[areaId];
  if (!area) throw new Error(`Unknown area: ${areaId}`);
  return area;
}

export {
  gtmArea,
  csmArea,
  csArea,
  engineeringArea,
  productDesignArea,
  dataArea,
  itArea,
  financeArea,
};
