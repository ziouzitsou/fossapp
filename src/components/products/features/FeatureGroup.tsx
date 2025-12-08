'use client';

import React, { useState, useCallback } from 'react';
import { logEventClient } from '@/lib/event-logger';
import { Feature } from '@/types/product';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { IconType } from 'react-icons';
import { FeatureValueRenderer } from './FeatureValueRenderer';
import { hasDisplayableValue } from '@/lib/utils/feature-utils';

interface FeatureGroupProps {
  groupId: string;
  groupName: string;
  features: Feature[];
  icon?: IconType;
  color?: string;
  defaultExpanded?: boolean;
  collapsible?: boolean;
}

/**
 * Collapsible feature group with smart display
 */
export function FeatureGroup({
  groupId,
  groupName,
  features,
  icon: Icon,
  color = 'text-gray-600',
  defaultExpanded = false,
  collapsible = true
}: FeatureGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = useCallback(() => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    logEventClient('product_details_expanded', {
      group_id: groupId,
      group_name: groupName,
      is_expanded: newState,
      feature_count: features.length,
    });
  }, [isExpanded, groupId, groupName, features.length]);

  // Filter features with displayable values
  const displayableFeatures = features.filter(hasDisplayableValue);

  if (displayableFeatures.length === 0) {
    return null;
  }

  // Determine how many features to show initially
  const initialDisplayCount = 5;
  const hasMore = displayableFeatures.length > initialDisplayCount;
  const displayedFeatures = isExpanded
    ? displayableFeatures
    : displayableFeatures.slice(0, initialDisplayCount);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className={collapsible ? 'cursor-pointer' : ''}
        onClick={() => collapsible && handleToggle()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className={`h-5 w-5 ${color}`} />}
            <h3 className="text-lg font-bold">{groupName}</h3>
            <Badge variant="outline" className="ml-2">
              {displayableFeatures.length} features
            </Badge>
          </div>
          {collapsible && hasMore && (
            <Button variant="ghost" size="sm">
              {isExpanded ? (
                <>
                  <FaChevronUp className="mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <FaChevronDown className="mr-1" />
                  +{displayableFeatures.length - initialDisplayCount} more
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayedFeatures.map((feature, idx) => (
            <div
              key={`${feature.FEATUREID}-${idx}`}
              className="flex justify-between items-start py-2 border-b last:border-0"
            >
              <span className="text-sm text-muted-foreground flex-1 mr-4">
                {feature.feature_name}
                {feature.FEATUREID && process.env.NODE_ENV === 'development' && (
                  <span className="ml-2 text-xs opacity-50">
                    ({feature.FEATUREID})
                  </span>
                )}
              </span>
              <div className="flex-shrink-0">
                <FeatureValueRenderer feature={feature} variant="default" />
              </div>
            </div>
          ))}
        </div>
        {!isExpanded && hasMore && (
          <div className="mt-3 pt-3 border-t text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleToggle();
              }}
            >
              Show all {displayableFeatures.length} features
              <FaChevronDown className="ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}