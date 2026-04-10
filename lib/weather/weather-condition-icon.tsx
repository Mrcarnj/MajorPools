import type { LucideIcon } from 'lucide-react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Snowflake,
  Sun,
} from 'lucide-react';

export function weatherIconForCode(code: number): LucideIcon {
  if (code === 0) return Sun;
  if (code === 1) return Sun;
  if (code === 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if (code >= 61 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return Snowflake;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code >= 85 && code <= 86) return Snowflake;
  if (code >= 95) return CloudLightning;
  return CloudSun;
}

export function WeatherConditionIcon({
  code,
  className,
}: {
  code: number;
  className?: string;
}) {
  const Icon = weatherIconForCode(code);
  return <Icon className={className} aria-hidden />;
}
