import { useState } from 'react';
import { PublicMap } from './components/PublicMap';
import { WelcomeLegend } from './components/WelcomeLegend';
import { SkinChrome } from './components/SkinChrome';
import { hasSeenWelcome, markWelcomeSeen } from './services/places';
import { currentSkin } from './utils/skin';

export function PublicApp() {
  const living = currentSkin() === 'living';
  const [showWelcome, setShowWelcome] = useState(() => !hasSeenWelcome());

  const handleWelcomeContinue = () => {
    markWelcomeSeen();
    setShowWelcome(false);
  };

  if (showWelcome) {
    return (
      <div className="app-shell public-app-shell">
        {living && <SkinChrome />}
        <WelcomeLegend onContinue={handleWelcomeContinue} />
      </div>
    );
  }

  return (
    <div className="app-shell public-app-shell">
      {living && <SkinChrome />}
      <PublicMap />
    </div>
  );
}
