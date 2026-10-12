import type { Feature } from '../src/shared/types';

export interface FeatureDefinition extends Feature {
  keywords: string[];
  goal: string;
  entities: string[];
  flow: string[];
  rules: string[];
  edgeCases: string[];
  acceptance: string[];
}
