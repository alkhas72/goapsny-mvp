import { useEffect, useState } from 'react';
import { MODULES_EVENT, currentFlags, type ModuleFlags } from './registry';

/** Флаги модулей; компонент перерисовывается, когда модуль включили или он погас. */
export function useModuleFlags(): ModuleFlags {
  const [flags, setFlags] = useState<ModuleFlags>(() => currentFlags());
  useEffect(() => {
    const sync = () => setFlags(currentFlags());
    window.addEventListener(MODULES_EVENT, sync);
    sync();
    return () => window.removeEventListener(MODULES_EVENT, sync);
  }, []);
  return flags;
}
