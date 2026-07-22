import type { ComponentProps } from 'react';
import { EventsPanel } from '../dashboard-components';

export type EventsTabPanelProps = ComponentProps<typeof EventsPanel>;

export function EventsTabPanel(props: EventsTabPanelProps) {
  return <EventsPanel {...props} />;
}
