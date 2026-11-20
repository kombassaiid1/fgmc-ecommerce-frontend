import {
  BadgeCheck,
  Box,
  CircleHelp,
  Clock,
  Columns3,
  Grid3x3,
  Heading,
  Image as ImageIcon,
  LayoutGrid,
  LayoutPanelTop,
  LayoutTemplate,
  Mail,
  Phone,
  Megaphone,
  MapPin,
  MousePointerClick,
  MoveVertical,
  ShoppingBag,
  TextCursorInput,
  Type,
  Zap,
  type LucideIcon,
} from "lucide-react";

// Icon shown on each block tile in the left panel, keyed by the block's name
// in `puckConfig.components`. Unknown names fall back to a generic box.
const BLOCK_ICONS: Record<string, LucideIcon> = {
  Container: LayoutPanelTop,
  Grid: Grid3x3,
  Input: TextCursorInput,
  Hero: LayoutTemplate,
  DailyOffers: Zap,
  FeaturedProducts: ShoppingBag,
  ImageMosaic: LayoutGrid,
  Heading,
  Text: Type,
  Button: MousePointerClick,
  Image: ImageIcon,
  Columns: Columns3,
  Spacer: MoveVertical,
  Faq: CircleHelp,
  ContactForm: Mail,
  ContactInfo: Phone,
  Map: MapPin,
  Hours: Clock,
  CategoryGrid: LayoutGrid,
  ProductGrid: ShoppingBag,
  PromoBanner: Megaphone,
  BrandsStrip: BadgeCheck,
  Newsletter: Mail,
};

export function BlockIcon({ name, className }: { name: string; className?: string }) {
  const Icon = BLOCK_ICONS[name] ?? Box;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.6} />;
}
