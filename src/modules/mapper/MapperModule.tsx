import { MapperDay } from '../../components/mapper/MapperDay';
import { MapperFlow } from '../../components/mapper/MapperFlow';
import { ModerationQueue } from '../../components/mapper/ModerationQueue';
import type { DayEntry } from '../../components/mapper/dayLog';
import type { MapperAccount } from '../../services/moderation';

export type MapperScreen = 'flow' | 'day' | 'queue';

export interface MapperModuleProps {
  screen: MapperScreen;
  theme: 'light' | 'dark';
  flowKey: number;
  ownerId: string | null;
  canLive: boolean;
  account: MapperAccount | null;
  accountLabel: string | null;
  queueCount: number | null;
  getCenter: () => { lat: number; lng: number } | null;
  onScreen: (next: MapperScreen | null) => void;
  onAnother: () => void;
  onSaved: (entries: DayEntry[]) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onQueueChanged: (left: number, published: boolean) => void;
}

/**
 * Модуль «картограф»: путь «Новый объект», кабинет и очередь проверки.
 * Грузится отдельным куском кода и стоит в границе модуля: его сбой карту не задевает.
 */
export default function MapperModule(props: MapperModuleProps) {
  const { screen, onScreen } = props;
  if (screen === 'flow') {
    return (
      <MapperFlow
        key={`flow-${props.flowKey}`}
        theme={props.theme}
        getCenter={props.getCenter}
        ownerId={props.ownerId}
        canLive={props.canLive}
        onAnother={props.onAnother}
        onClose={() => onScreen(null)}
        onSaved={props.onSaved}
        onOpenDay={() => onScreen('day')}
      />
    );
  }
  if (screen === 'day') {
    return (
      <MapperDay
        account={props.account}
        accountLabel={props.accountLabel}
        queueCount={props.queueCount}
        onClose={() => onScreen(null)}
        onSignIn={props.onSignIn}
        onSignOut={props.onSignOut}
        onOpenQueue={() => onScreen('queue')}
      />
    );
  }
  return (
    <ModerationQueue theme={props.theme} onClose={() => onScreen('day')} onChanged={props.onQueueChanged} />
  );
}
