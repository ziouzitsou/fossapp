'use client';

import React from 'react';
import { Feature } from '@/types/product';
import { Badge } from '@/components/ui/badge';
import { getFeatureDisplayValue } from '@/lib/utils/feature-utils';
import { FaCheck, FaTimes } from 'react-icons/fa';

interface FeatureValueRendererProps {
  feature: Feature;
  variant?: 'default' | 'compact' | 'inline';
  showUnit?: boolean;
}

/**
 * Smart feature value renderer with type-specific formatting
 */
export function FeatureValueRenderer({
  feature,
  variant = 'default',
  showUnit: _showUnit = true
}: FeatureValueRendererProps) {
  const value = getFeatureDisplayValue(feature);

  // Boolean values get special treatment
  if (feature.fvalueB !== null) {
    if (variant === 'inline') {
      return (
        <span className={feature.fvalueB ? 'text-green-600' : 'text-muted-foreground'}>
          {feature.fvalueB ? <FaCheck className="inline" /> : <FaTimes className="inline" />}
          {' '}{value}
        </span>
      );
    }
    return (
      <Badge variant={feature.fvalueB ? 'default' : 'outline'}>
        {feature.fvalueB ? <FaCheck className="mr-1" /> : <FaTimes className="mr-1" />}
        {value}
      </Badge>
    );
  }

  // Special rendering for certain feature types
  if (feature.FEATUREID === 'EF002638' && feature.fvalueN) {
    // Color temperature - show warm/cool indicator
    const temp = feature.fvalueN;
    let colorClass = 'text-yellow-600';
    if (temp >= 4000) colorClass = 'text-blue-600';
    else if (temp >= 3500) colorClass = 'text-slate-600';

    if (variant === 'compact') {
      return <span className={colorClass}>{value}</span>;
    }
    return (
      <div className="flex items-center gap-2">
        <span className="font-semibold">{value}</span>
        <Badge variant="outline" className={colorClass}>
          {temp < 3000 ? 'Warm' : temp < 4000 ? 'Neutral' : 'Cool'}
        </Badge>
      </div>
    );
  }

  // IP Rating gets special badge
  if (feature.FEATUREID === 'EF000159' && feature.fvalueC_desc) {
    const ipValue = feature.fvalueC_desc;
    const ipMatch = ipValue.match(/IP(\d{2})/);
    if (ipMatch && variant !== 'inline') {
      const rating = parseInt(ipMatch[1]);
      const isOutdoor = rating >= 65;
      return (
        <Badge variant={isOutdoor ? 'default' : 'outline'}>
          {ipValue}
          {isOutdoor && ' (Outdoor)'}
        </Badge>
      );
    }
  }

  // Power values get wattage emphasis
  if (feature.FEATUREID === 'EF000123' && feature.fvalueN) {
    if (variant === 'compact') {
      return <span className="font-bold">{value}</span>;
    }
    return (
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold">{feature.fvalueN}</span>
        <span className="text-muted-foreground">{feature.unit_abbrev}</span>
      </div>
    );
  }

  // Beam angle gets visual indicator
  if (feature.FEATUREID === 'EF005996' && feature.fvalueN) {
    const angle = feature.fvalueN;
    let beamType = 'Wide';
    if (angle < 25) beamType = 'Narrow';
    else if (angle < 45) beamType = 'Medium';

    if (variant === 'compact') {
      return <span>{value}</span>;
    }
    return (
      <div className="flex items-center gap-2">
        <span className="font-semibold">{value}</span>
        <Badge variant="outline">{beamType} beam</Badge>
      </div>
    );
  }

  // CRI gets quality indicator
  if (feature.FEATUREID === 'EF001678' && feature.fvalueN) {
    const cri = feature.fvalueN;
    let quality = 'Good';
    let colorClass = 'text-yellow-600';
    if (cri >= 90) {
      quality = 'Excellent';
      colorClass = 'text-green-600';
    } else if (cri >= 80) {
      quality = 'Very Good';
      colorClass = 'text-blue-600';
    }

    if (variant === 'compact') {
      return <span className={colorClass}>{value}</span>;
    }
    return (
      <div className="flex items-center gap-2">
        <span className="font-semibold">{value}</span>
        <Badge variant="outline" className={colorClass}>
          {quality} color rendering
        </Badge>
      </div>
    );
  }

  // Default rendering
  if (variant === 'inline') {
    return <span className="font-medium">{value}</span>;
  }

  if (variant === 'compact') {
    return <span className="text-sm font-medium">{value}</span>;
  }

  return <span className="font-semibold">{value}</span>;
}