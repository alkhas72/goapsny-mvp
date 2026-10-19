import { useState } from 'react';
import { PublicMap } from './components/PublicMap';
import { WelcomeLegend } from './components/WelcomeLegend';
import { hasSeenWelcome, markWelcomeSeen } from './services/places';

export function PublicApp() {
  const [showWelcome, setShowWelcome] = useState(() => !hasSeenWelcome());

  const handleWelcomeContinue = () => {
    markWelcomeSeen();
    setShowWelcome(false);
  };

  // The welcome legend is an overlay over the live map (DESIGN.md §7).
  return (
    <div className="app-shell public-app-shell">
      <PublicMap />
      {showWelcome && <WelcomeLegend onContinue={handleWelcomeContinue} />}
    </div>
  );
}
