import type { ComponentProps } from 'react';
import { BuyersPanel } from '../dashboard-components';

export type BuyersTabPanelProps = ComponentProps<typeof BuyersPanel>;

export function BuyersTabPanel(props: BuyersTabPanelProps) {
  return <BuyersPanel {...props} />;
}
