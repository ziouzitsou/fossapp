/**
 * Feature Groups Display - Organized product specifications
 *
 * Renders product features grouped by ETIM Feature Group (EFGxxxxx),
 * with a "Key Specifications" card highlighting the most important features.
 *
 * @remarks
 * **Feature Organization**:
 * - Groups are defined by ETIM's FEATUREGROUPID (e.g., EFG00006 = Electrical)
 * - Important features are extracted based on priority rules (CCT, CRI, IP, etc.)
 * - Unconfigured groups are collapsed into "Other Specifications"
 *
 * @see {@link FEATURE_GROUP_CONFIG} for group display configuration
 * @see {@link getImportantFeatures} for priority feature selection
 */
'use client';

import React from 'react';
import { ProductInfo } from '@fossapp/products/types';
import { FeatureGroup } from './FeatureGroup';
import {
  groupFeaturesByCategory,
  FEATURE_GROUP_CONFIG,
  getImportantFeatures
} from '@/lib/utils/feature-utils';
import { Card, CardContent } from '@fossapp/ui';
import { FeatureValueRenderer } from './FeatureValueRenderer';

/**
 * Props for the FeatureGroupsDisplay component.
 */
interface FeatureGroupsDisplayProps {
  product: ProductInfo;
  showQuickView?: boolean;
  defaultExpandedGroups?: string[];
}

/**
 * Smart feature display with grouped organization
 */
export function FeatureGroupsDisplay({
  product,
  showQuickView = true,
  defaultExpandedGroups = ['EFG00006', 'EFG00009'] // Electrical and Light by default
}: FeatureGroupsDisplayProps) {
  const groupedFeatures = groupFeaturesByCategory(product.features);

  // Get important features for quick view
  const importantFeatures = getImportantFeatures(product.features, 6);

  if (!product.features || product.features.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No specifications available
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick View - Most Important Features */}
      {showQuickView && importantFeatures.length > 0 && (
        <Card className="border-2 border-primary/20">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4">Key Specifications</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {importantFeatures.map((feature, idx) => (
                <div
                  key={`important-${feature.FEATUREID}-${idx}`}
                  className="flex flex-col space-y-1"
                >
                  <span className="text-xs text-muted-foreground">
                    {feature.feature_name}
                  </span>
                  <FeatureValueRenderer feature={feature} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grouped Features */}
      <div className="space-y-4">
        {(() => {
          const configuredGroups: React.ReactElement[] = [];
          const unconfiguredFeatures: typeof product.features = [];

          // Separate configured and unconfigured groups
          Object.entries(groupedFeatures).forEach(([groupId, features]) => {
            const config = FEATURE_GROUP_CONFIG[groupId];

            if (config) {
              // Render configured groups
              configuredGroups.push(
                <FeatureGroup
                  key={groupId}
                  groupId={groupId}
                  groupName={config.name}
                  features={features}
                  icon={config.icon}
                  color={config.color}
                  defaultExpanded={defaultExpandedGroups.includes(groupId)}
                  collapsible={features.length > 5}
                />
              );
            } else {
              // Collect unconfigured features
              unconfiguredFeatures.push(...features);
            }
          });

          // Add single "Other Specifications" section for all unconfigured features
          if (unconfiguredFeatures.length > 0) {
            configuredGroups.push(
              <FeatureGroup
                key="other"
                groupId="other"
                groupName={`Other Specifications (${unconfiguredFeatures.length} total)`}
                features={unconfiguredFeatures}
                collapsible={unconfiguredFeatures.length > 5}
              />
            );
          }

          return configuredGroups;
        })()}
      </div>
    </div>
  );
}